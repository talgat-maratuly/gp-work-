import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';
import { User } from '../../entities';
import { WorkflowService } from '../workflow/workflow.service';
import { BusinessActionDto, PublishBusinessProcessDto } from './business-process.dto';
import { applyValues, canReadField, ProcessSchema, roleAllowed, validateSchema, validateTransition } from './business-process.rules';

type Definition = { id: number; process_id: number; version: number; schema: ProcessSchema; archived: boolean };
type Instance = { id: number; task_id: number; definition_id: number; process_id: number; stage_id: string; values: Record<string, unknown>; revision: number; schema: ProcessSchema; version: number };
const closedTasks = ['VERIFIED', 'CANCELLED'];
@Injectable()
export class BusinessProcessService {
  constructor(private readonly db: DataSource, private readonly workflow: WorkflowService) {}

  private assertAdmin(user: User) {
    if (!['ADMIN', 'DIRECTOR'].includes(user.role)) throw new ForbiddenException('Конструктор доступен администратору и директору');
  }
  async catalog() {
    return this.db.query(`SELECT DISTINCT ON(d.process_id) d.*, p.archived FROM business_process_definitions d
      JOIN business_processes p ON p.id=d.process_id ORDER BY d.process_id, d.version DESC`);
  }
  async publish(dto: PublishBusinessProcessDto, user: User) {
    this.assertAdmin(user);
    const schema = validateSchema(dto);
    return this.db.transaction(async q => {
      let processId = dto.processId;
      let version = 1;
      if (processId) {
        const [process] = await q.query('SELECT * FROM business_processes WHERE id=$1 FOR UPDATE', [processId]);
        if (!process) throw new NotFoundException('Процесс не найден');
        if (process.archived) throw new BadRequestException('Сначала восстановите процесс из архива');
        const [latest] = await q.query('SELECT version FROM business_process_definitions WHERE process_id=$1 ORDER BY version DESC LIMIT 1', [processId]);
        if (dto.baseVersion !== latest.version) throw new ConflictException('Шаблон уже изменён. Обновите список и откройте последнюю версию');
        version = latest.version + 1;
      } else {
        if (dto.baseVersion) throw new BadRequestException('Для новой версии требуется существующий процесс');
        const [process] = await q.query('INSERT INTO business_processes(created_by_id) VALUES($1) RETURNING id', [user.id]);
        processId = process.id;
      }
      const [definition] = await q.query(`INSERT INTO business_process_definitions(process_id,version,schema,created_by_id)
        VALUES($1,$2,$3,$4) RETURNING *`, [processId, version, JSON.stringify(schema), user.id]);
      return { ...definition, archived: false };
    });
  }
  async archive(id: number, archived: boolean, user: User) {
    this.assertAdmin(user);
    const rows = await this.db.query('UPDATE business_processes SET archived=$2 WHERE id=$1 RETURNING id,archived', [id, archived]);
    // TypeORM returns [rows, affected] for UPDATE statements with the PostgreSQL driver.
    const row = Array.isArray(rows[0]) ? rows[0][0] : rows[0];
    if (!row) throw new NotFoundException('Процесс не найден');
    return row;
  }
  async attach(taskId: number, definitionId: number, user: User) {
    return this.db.transaction(async q => {
      await q.query('SELECT id FROM tasks WHERE id=$1 FOR UPDATE', [taskId]);
      const task = await this.workflow.managedTask(taskId, user, q);
      if (closedTasks.includes(task.status)) throw new BadRequestException('Нельзя подключить процесс к закрытой задаче');
      const [d]: Definition[] = await q.query(`SELECT d.*, p.archived FROM business_process_definitions d
        JOIN business_processes p ON p.id=d.process_id WHERE d.id=$1 FOR UPDATE OF p`, [definitionId]);
      if (!d || d.archived) throw new BadRequestException('Действующий шаблон не найден');
      const [existing] = await q.query('SELECT id FROM business_process_instances WHERE task_id=$1 AND process_id=$2', [taskId, d.process_id]);
      if (existing) throw new ConflictException('Этот процесс уже подключён к задаче');
      const [latest] = await q.query('SELECT id FROM business_process_definitions WHERE process_id=$1 ORDER BY version DESC LIMIT 1', [d.process_id]);
      if (d.id !== latest.id) throw new ConflictException('Вышла новая версия процесса. Обновите список');
      const [instance] = await q.query(`INSERT INTO business_process_instances(task_id,definition_id,process_id,stage_id,created_by_id)
        VALUES($1,$2,$3,$4,$5) RETURNING *`, [taskId, d.id, d.process_id, d.schema.initialStageId, user.id]);
      await this.event(q, instance.id, user.id, 'ATTACHED', null, instance.stage_id, {});
      return { id: instance.id };
    });
  }
  private async event(q: EntityManager, id: number, actorId: number, kind: string, from: string | null, to: string, changes: unknown) {
    await q.query(`INSERT INTO business_process_events(instance_id,actor_id,kind,from_stage_id,to_stage_id,changes)
      VALUES($1,$2,$3,$4,$5,$6)`, [id, actorId, kind, from, to, JSON.stringify(changes)]);
  }
  async forTask(taskId: number, user: User) {
    const task = await this.workflow.task(taskId, user);
    const instances: Instance[] = await this.db.query(`SELECT i.*, d.schema, d.version FROM business_process_instances i
      JOIN business_process_definitions d ON d.id=i.definition_id WHERE i.task_id=$1 ORDER BY i.id`, [taskId]);
    return Promise.all(instances.map(async i => {
      const visible = i.schema.fields.filter(f => canReadField(user.role, f));
      const visibleIds = new Set(visible.map(f => f.id));
      const stage = i.schema.stages.find(s => s.id === i.stage_id)!;
      const locked = closedTasks.includes(task.status) || !stage.nextStages.length;
      const filter = (values: Record<string, unknown>) => Object.fromEntries(Object.entries(values).filter(([id]) => visibleIds.has(id)));
      const history = await this.db.query(`SELECT e.*, u.full_name actor_name FROM business_process_events e
        LEFT JOIN users u ON u.id=e.actor_id WHERE e.instance_id=$1 ORDER BY e.id DESC LIMIT 100`, [i.id]);
      return { ...i, values: filter(i.values), locked,
        schema: { ...i.schema, fields: visible, stages: i.schema.stages.map(s => ({ ...s, requiredFields: s.requiredFields.filter(id => visibleIds.has(id)) })) },
        editableFieldIds: locked ? [] : visible.filter(f => roleAllowed(user.role, f.editRoles)).map(f => f.id),
        allowedTransitions: locked || !roleAllowed(user.role, stage.roles) ? [] : stage.nextStages,
        events: history.map((e: { changes: Record<string, unknown> }) => ({ ...e, changes: filter(e.changes) })),
      };
    }));
  }
  async action(taskId: number, instanceId: number, dto: BusinessActionDto, user: User) {
    return this.db.transaction(async q => {
      await q.query('SELECT id FROM tasks WHERE id=$1 FOR UPDATE', [taskId]);
      const task = await this.workflow.task(taskId, user, q);
      const [i]: Instance[] = await q.query(`SELECT i.*, d.schema, d.version FROM business_process_instances i
        JOIN business_process_definitions d ON d.id=i.definition_id WHERE i.task_id=$1 AND i.id=$2 FOR UPDATE OF i`, [taskId, instanceId]);
      if (!i) throw new NotFoundException('Процесс задачи не найден');
      if (i.revision !== dto.revision) throw new ConflictException('Данные процесса изменились. Обновите карточку перед сохранением');
      const stage = i.schema.stages.find(s => s.id === i.stage_id)!;
      if (closedTasks.includes(task.status) || !stage.nextStages.length) throw new BadRequestException('Задача или процесс закрыты; история доступна для просмотра');
      const values = applyValues(i.schema, i.values, dto.values, user.role);
      const to = dto.toStageId ?? i.stage_id;
      if (dto.toStageId !== undefined) validateTransition(i.schema, i.stage_id, to, values, user.role);
      const changes = Object.fromEntries(Object.keys(dto.values).filter(id => i.values[id] !== values[id]).map(id => [id, { before: i.values[id] ?? null, after: values[id] ?? null }]));
      if (!Object.keys(changes).length && dto.toStageId === undefined) return { id: i.id, revision: i.revision };
      await q.query('UPDATE business_process_instances SET values=$2,stage_id=$3,revision=revision+1,updated_at=now() WHERE id=$1', [i.id, JSON.stringify(values), to]);
      await this.event(q, i.id, user.id, dto.toStageId === undefined ? 'FIELDS_SAVED' : 'TRANSITION', i.stage_id, to, changes);
      return { id: i.id, revision: i.revision + 1 };
    });
  }
}
