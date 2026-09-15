import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';
import { User } from '../../entities';
import { businessDateString } from '../../common/business-date';
import { allChecked, improved, waitingByCategory } from './workflow.rules';
import { ChecksDto, ImprovementActionDto, ImprovementDto, ObstacleActionDto, ObstacleDto, PlanDto, StandardDto, ToolActionDto, ToolDto } from './workflow.dto';

type TaskRow = { id: number; work_type_id: number | null; assignee_user_id: number | null; brigade_id: number | null; created_by_id: number | null; status: string; section_id: number; description: string; section_name: string; section_code: string; object_name: string; latitude: number | null; longitude: number | null; radius_meters: number | null; section_active: boolean; object_active: boolean };
type PlanRow = { task_id: number; standard_id: number; accountable_id: number; reviewer_id: number; wip_limit: number; required_tool_ids: number[]; materials: {productId: number; quantity: number}[]; ready_at: Date | null; checked_preparation: number[]; completed_steps: number[]; steps: string[]; preparation: string[]; acceptance: string; title: string; version: number; accountable_name: string; reviewer_name: string };
const managers = ['ADMIN','DIRECTOR','BRIGADIER','AGRONOMIST'];
const closed = ['COMPLETED','VERIFIED','CANCELLED'];
@Injectable()
export class WorkflowService {
  constructor(private readonly db: DataSource) {}
  private global(user: Pick<User,'role'>) { return ['ADMIN','DIRECTOR'].includes(user.role); }
  private manages(t: TaskRow, u: Pick<User,'id'|'role'|'brigadeId'>) {
    return this.global(u) || (u.role === 'BRIGADIER' && !!u.brigadeId && t.brigade_id === u.brigadeId) || (u.role === 'AGRONOMIST' && t.created_by_id === u.id);
  }
  private executes(t: TaskRow, u: Pick<User,'id'|'role'|'brigadeId'>) {
    return ['WORKER','WATER_CARRIER','BRIGADIER','AGRONOMIST'].includes(u.role) && (t.assignee_user_id === u.id || (!!u.brigadeId && t.brigade_id === u.brigadeId));
  }
  private assertManager(t: TaskRow, u: User) { if (!this.manages(t,u)) throw new ForbiddenException('Изменять подготовку может руководитель этой задачи'); }
  private taskSelect = `SELECT t.*, s.name section_name, s.code section_code, s.object_id, s.latitude, s.longitude, s.radius_meters,
    s.is_active section_active, o.is_active object_active, o.name object_name,
    a.full_name assignee_name, w.name work_type_name
    FROM tasks t JOIN sections s ON s.id=t.section_id JOIN objects o ON o.id=s.object_id
    LEFT JOIN users a ON a.id=t.assignee_user_id LEFT JOIN work_types w ON w.id=t.work_type_id`;
  async task(id: number, user: User, q: EntityManager = this.db.manager): Promise<TaskRow> {
    const [t] = await q.query(`${this.taskSelect} WHERE t.id=$1`, [id]);
    if (!t) throw new NotFoundException('Задача не найдена');
    if (!this.manages(t,user) && !this.executes(t,user)) throw new ForbiddenException('Нет доступа к задаче');
    return t;
  }
  async managedTask(id: number, user: User, q: EntityManager = this.db.manager) {
    const task = await this.task(id, user, q);
    this.assertManager(task, user);
    return task;
  }
  private async plan(id: number, q: EntityManager = this.db.manager): Promise<PlanRow | undefined> {
    const [p] = await q.query(`SELECT p.*, s.steps, s.preparation, s.acceptance, s.title, s.version,
      a.full_name accountable_name, r.full_name reviewer_name FROM work_task_plans p
      JOIN work_standards s ON s.id=p.standard_id JOIN users a ON a.id=p.accountable_id
      JOIN users r ON r.id=p.reviewer_id WHERE p.task_id=$1`, [id]);
    return p;
  }
  private async event(q: EntityManager, taskId: number | null, user: User, kind: string, details: unknown) {
    await q.query('INSERT INTO work_flow_events(task_id,actor_id,kind,details) VALUES($1,$2,$3,$4)',[taskId,user.id,kind,JSON.stringify(details)]);
  }
  private async candidate(id: number, task: TaskRow, q: EntityManager, management = true) {
    const [u] = await q.query('SELECT id,role,brigade_id AS "brigadeId" FROM users WHERE id=$1 AND is_active=true',[id]);
    if (!u || !(management ? this.manages(task,u) : this.manages(task,u) || this.executes(task,u))) throw new BadRequestException('Ответственный должен быть активным сотрудником с доступом к этой задаче');
    return u;
  }
  async catalog(user: User) {
    const standards = await this.db.query(`SELECT DISTINCT ON(work_type_id) s.*, w.name work_type_name FROM work_standards s
      JOIN work_types w ON w.id=s.work_type_id WHERE w.is_active=true ORDER BY work_type_id,version DESC`);
    const workTypes = await this.db.query('SELECT id,name FROM work_types WHERE is_active=true ORDER BY name');
    const people = managers.includes(user.role) ? await this.db.query(`SELECT id,full_name AS name,role,brigade_id FROM users
      WHERE is_active=true AND (role IN ('ADMIN','DIRECTOR') OR id=$1 OR (($3=true OR brigade_id=$2) AND role IN ('BRIGADIER','AGRONOMIST'))) ORDER BY full_name`,[user.id,user.brigadeId ?? -1,this.global(user)]) : [];
    const products = await this.db.query('SELECT id,name,unit FROM products WHERE is_actual=true ORDER BY name');
    return {standards,workTypes,people,products};
  }
  private async insertStandard(dto: StandardDto, user: User, q: EntityManager) {
    const [workType] = await q.query('SELECT id FROM work_types WHERE id=$1 AND is_active=true FOR UPDATE',[dto.workTypeId]);
    if (!workType) throw new BadRequestException('Активный вид работы не найден');
    if ([...dto.steps,...dto.preparation].some(s => !s.trim())) throw new BadRequestException('Пункты инструкции не могут быть пустыми');
    const [{version}] = await q.query('SELECT COALESCE(MAX(version),0)+1 version FROM work_standards WHERE work_type_id=$1',[dto.workTypeId]);
    const [standard] = await q.query(`INSERT INTO work_standards(work_type_id,version,title,steps,preparation,acceptance,created_by_id)
      VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING *`,[dto.workTypeId,version,dto.title,JSON.stringify(dto.steps.map(s=>s.trim())),JSON.stringify(dto.preparation.map(s=>s.trim())),dto.acceptance,user.id]);
    return standard;
  }
  async saveStandard(dto: StandardDto,user: User) {
    if (!this.global(user)) throw new ForbiddenException('Общие стандарты утверждает директор');
    return this.db.transaction(async q => {
      const s = await this.insertStandard(dto,user,q);
      await this.event(q,null,user,'STANDARD_CREATED',{standardId:s.id,version:s.version}); return s;
    });
  }
  async configure(id: number,dto: PlanDto,user: User) {
    return this.db.transaction(async q => {
      const t = await this.task(id,user,q); this.assertManager(t,user);
      await q.query('SELECT id FROM tasks WHERE id=$1 FOR UPDATE',[id]);
      if (!['ASSIGNED','ACCEPTED'].includes(t.status)) throw new BadRequestException('Стандарт и ответственных задают до начала работы');
      const [execution] = await q.query('SELECT id FROM work_executions WHERE task_id=$1',[id]);
      if (execution) throw new BadRequestException('Подготовка уже зафиксирована прибытием. Создайте отдельную задачу для нового порядка');
      const [s] = await q.query('SELECT * FROM work_standards WHERE id=$1 AND work_type_id=$2',[dto.standardId,t.work_type_id]);
      if (!s) throw new BadRequestException('Стандарт не соответствует виду работы');
      await this.candidate(dto.accountableId,t,q); await this.candidate(dto.reviewerId,t,q);
      if (dto.reviewerId === t.assignee_user_id) throw new BadRequestException('Исполнитель не может принимать собственную работу');
      if (dto.toolIds.length) {
        const tools = await q.query("SELECT id FROM work_tools WHERE id=ANY($1::int[]) AND state <> 'RETIRED'",[dto.toolIds]);
        if (tools.length !== dto.toolIds.length) throw new BadRequestException('Один из инструментов не найден или списан');
      }
      if (new Set(dto.materials.map(m=>m.productId)).size !== dto.materials.length) throw new BadRequestException('Материал повторяется');
      for (const material of dto.materials) {
        const [product] = await q.query('SELECT id FROM products WHERE id=$1 AND is_actual=true',[material.productId]);
        if (!product) throw new BadRequestException('Активный материал не найден');
      }
      await q.query(`INSERT INTO work_task_plans(task_id,standard_id,accountable_id,reviewer_id,wip_limit,required_tool_ids,materials)
        VALUES($1,$2,$3,$4,$5,$6,$7) ON CONFLICT(task_id) DO UPDATE SET standard_id=$2,accountable_id=$3,reviewer_id=$4,
        wip_limit=$5,required_tool_ids=$6,materials=$7,ready_at=NULL,prepared_by_id=NULL,checked_preparation='{}',completed_steps='{}',updated_at=now()`,
        [id,s.id,dto.accountableId,dto.reviewerId,dto.wipLimit,dto.toolIds,JSON.stringify(dto.materials)]);
      await this.event(q,id,user,'PLAN_CONFIGURED',dto); return this.plan(id,q);
    });
  }
  private async readiness(t: TaskRow,p: PlanRow,q: EntityManager) {
    const reasons: string[] = [];
    if (!t.section_active || !t.object_active) reasons.push('Объект или участок в архиве');
    if (t.latitude == null || t.longitude == null || !Number.isFinite(Number(t.latitude)) || !Number.isFinite(Number(t.longitude)) || Math.abs(Number(t.latitude))>90 || Math.abs(Number(t.longitude))>180 || (t.radius_meters ?? 150)<10 || (t.radius_meters ?? 150)>5000) reasons.push('Не настроены координаты участка');
    const staff = await q.query('SELECT id FROM users WHERE id=ANY($1::int[]) AND is_active=true',[[t.assignee_user_id,p.accountable_id,p.reviewer_id].filter(x=>x!=null)]);
    if (!t.assignee_user_id || new Set(staff.map((u:{id:number})=>u.id)).size !== new Set([t.assignee_user_id,p.accountable_id,p.reviewer_id]).size) reasons.push('Исполнитель или руководитель неактивен');
    const tools = p.required_tool_ids.length ? await q.query('SELECT * FROM work_tools WHERE id=ANY($1::int[])',[p.required_tool_ids]) : [];
    for (const tool of tools) {
      if (tool.state !== 'ISSUED' || tool.task_id !== t.id) reasons.push(`Инструмент «${tool.name}» не выдан на эту задачу`);
    }
    if (tools.length !== p.required_tool_ids.length) reasons.push('Инструмент из комплекта не найден');
    for (const m of p.materials) {
      const [row] = await q.query(`SELECT p.name, COALESCE(SUM(CASE WHEN s.type='OUTCOME' THEN s.quantity WHEN s.type='RETURN' THEN -s.quantity ELSE 0 END),0)::float8 issued
        FROM products p LEFT JOIN stock_movements s ON s.product_id=p.id AND s.task_id=$2 WHERE p.id=$1 GROUP BY p.id`,[m.productId,t.id]);
      if (!row || row.issued < m.quantity) reasons.push(`Материал «${row?.name ?? m.productId}»: нужно выдать ${m.quantity}, выдано ${row?.issued ?? 0}`);
    }
    const [{count}] = await q.query("SELECT count(*)::int count FROM work_obstacles WHERE task_id=$1 AND status <> 'CLOSED'",[t.id]);
    if (count) reasons.push(`Незакрытых препятствий: ${count}`);
    return reasons;
  }
  async detail(id:number,user:User) {
    const task = await this.task(id,user); const plan = await this.plan(id);
    const obstacles = await this.db.query(`SELECT o.*, u.full_name reporter_name, r.full_name owner_name FROM work_obstacles o JOIN users u ON u.id=o.reporter_id JOIN users r ON r.id=o.owner_id WHERE o.task_id=$1 ORDER BY o.id DESC`,[id]);
    const improvements = await this.db.query(`SELECT i.*,u.full_name proposer_name,r.full_name owner_name FROM work_improvements i JOIN users u ON u.id=i.proposer_id LEFT JOIN users r ON r.id=i.owner_id WHERE i.task_id=$1 ORDER BY i.id DESC`,[id]);
    const tools = await this.db.query('SELECT * FROM work_tools WHERE task_id=$1 OR id=ANY($2::int[]) ORDER BY code',[id,plan?.required_tool_ids ?? []]);
    const events = await this.db.query(`SELECT e.id,e.kind,e.details,e.created_at,u.full_name actor_name FROM work_flow_events e JOIN users u ON u.id=e.actor_id WHERE e.task_id=$1 ORDER BY e.id DESC LIMIT 100`,[id]);
    const [execution] = await this.db.query('SELECT id,status FROM work_executions WHERE task_id=$1',[id]);
    const materials=[];
    for(const m of plan?.materials??[]) {
      const [row]=await this.db.query(`SELECT p.name,COALESCE(SUM(CASE WHEN s.type='OUTCOME' THEN s.quantity WHEN s.type='RETURN' THEN -s.quantity ELSE 0 END),0)::float8 issued FROM products p LEFT JOIN stock_movements s ON s.product_id=p.id AND s.task_id=$2 WHERE p.id=$1 GROUP BY p.id`,[m.productId,id]);
      materials.push({...m,name:row?.name??String(m.productId),required:m.quantity,issued:row?.issued??0,missing:Math.max(0,m.quantity-(row?.issued??0))});
    }
    return {materials,task,plan:plan ?? null,obstacles,improvements,tools,events,execution:execution ?? null,
      readiness:plan ? await this.readiness(task,plan,this.db.manager) : ['Руководитель ещё не задал стандарт и ответственных'],
      canManage:this.manages(task,user), canExecute:this.executes(task,user), canAdopt:this.global(user)};
  }
  async check(id:number,dto:ChecksDto,user:User,stage:'preparation'|'steps') {
    return this.db.transaction(async q => {
      const t=await this.task(id,user,q); if (!this.executes(t,user)) throw new ForbiddenException('Подтверждение выполняет сотрудник этой задачи');
      await q.query('SELECT task_id FROM work_task_plans WHERE task_id=$1 FOR UPDATE',[id]);
      const p=await this.plan(id,q); if(!p) throw new BadRequestException('Сначала руководитель задаёт стандарт');
      if(closed.includes(t.status)) throw new BadRequestException('Задача уже сдана или закрыта');
      const labels=stage==='preparation'?p.preparation:p.steps;
      if(dto.checked.some(i=>i>=labels.length)) throw new BadRequestException('Неизвестный пункт проверки');
      if(stage==='preparation') {
        if(!allChecked(dto.checked,labels)) throw new BadRequestException('Подтвердите все пункты подготовки');
        const reasons=await this.readiness(t,p,q); if(reasons.length) throw new BadRequestException(reasons.join('. '));
        await q.query('UPDATE work_task_plans SET ready_at=now(),prepared_by_id=$2,checked_preparation=$3,updated_at=now() WHERE task_id=$1',[id,user.id,dto.checked]);
      } else {
        if(!['IN_PROGRESS','REJECTED'].includes(t.status)) throw new BadRequestException('Пункты работы отмечаются после начала');
        await q.query('UPDATE work_task_plans SET completed_steps=$2,updated_at=now() WHERE task_id=$1',[id,dto.checked]);
      }
      await this.event(q,id,user,stage==='preparation'?'PREPARED':'STEPS_CHECKED',{checked:dto.checked}); return this.plan(id,q);
    });
  }
  // Both legacy and QR entry points use this gate; one advisory lock serializes starts per worker.
  async withStart<T>(id:number,user:User,action:(q:EntityManager)=>Promise<T>):Promise<T> {
    const p=await this.plan(id); if(!p) return action(this.db.manager); // Existing unconfigured work retains its established workflow.
    return this.db.transaction(async q=>{
      const t=await this.task(id,user,q);
      for(const key of [...new Set([user.id,t.assignee_user_id ?? user.id])].sort((a,b)=>a-b)) await q.query('SELECT pg_advisory_xact_lock(7315,$1)',[key]);
      const current=await this.plan(id,q);
      if(!current?.ready_at) throw new BadRequestException('Сначала подтвердите подготовку в карточке «Порядок работы»');
      const reasons=await this.readiness(t,current,q); if(reasons.length) throw new BadRequestException(reasons.join('. '));
      const [{count}] = await q.query(`SELECT count(DISTINCT t.id)::int count FROM tasks t LEFT JOIN work_executions e ON e.task_id=t.id
        WHERE t.id<>$1 AND (t.assignee_user_id=ANY($2::int[]) OR e.worker_user_id=$3)
        AND (t.status IN ('IN_PROGRESS','COMPLETED','REJECTED') OR e.status IN ('STARTED','IN_PROGRESS','COMPLETED','REJECTED'))`,[id,[user.id,t.assignee_user_id].filter(x=>x!=null),user.id]);
      if(count>=current.wip_limit) throw new ConflictException(`Лимит начатых задач: ${current.wip_limit}. Завершите текущую работу`);
      return action(q);
    });
  }
  async requireFieldRoute(id:number) {
    if(await this.plan(id)) throw new BadRequestException('Для подготовленной задачи используйте QR и экран выполнения: там проверяются геолокация, фото и приёмка');
  }
  async assertComplete(id:number) {
    const p=await this.plan(id); if(!p) return;
    if(!p.ready_at) throw new BadRequestException('Подготовка задачи не подтверждена');
    if(!allChecked(p.completed_steps,p.steps)) throw new BadRequestException('Отметьте все пункты стандарта работы');
    const [{count}]=await this.db.query("SELECT count(*)::int count FROM work_obstacles WHERE task_id=$1 AND status<>'CLOSED'",[id]);
    if(count) throw new BadRequestException('Сначала подтвердите устранение препятствий');
  }
  async assertReviewer(id:number,user:User) {
    const p=await this.plan(id); if(!p) return;
    if(p.reviewer_id!==user.id) throw new ForbiddenException('Работу принимает назначенный проверяющий');
    const [t]=await this.db.query('SELECT t.assignee_user_id,e.worker_user_id FROM tasks t LEFT JOIN work_executions e ON e.task_id=t.id WHERE t.id=$1',[id]);
    if(t.assignee_user_id===user.id || t.worker_user_id===user.id) throw new ForbiddenException('Нельзя принимать собственную работу');
  }
  async obstacle(id:number,dto:ObstacleDto,user:User) {
    return this.db.transaction(async q=>{
      const t=await this.task(id,user,q); if(closed.includes(t.status)) throw new BadRequestException('Работа уже сдана. Используйте предложение улучшения');
      const p=await this.plan(id,q); const owner=p?.accountable_id ?? t.created_by_id;
      if(!owner) throw new BadRequestException('Сначала назначьте ответственного за задачу');
      const [existing]=await q.query('SELECT * FROM work_obstacles WHERE client_operation_id=$1',[dto.clientOperationId]);
      if(existing) {
        if(existing.task_id!==id || existing.reporter_id!==user.id || existing.description!==dto.description || existing.category!==dto.category) throw new ConflictException('Идентификатор сообщения уже использован');
        return existing;
      }
      const [o]=await q.query(`INSERT INTO work_obstacles(task_id,reporter_id,owner_id,category,description,client_operation_id)
        VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT(client_operation_id) DO NOTHING RETURNING *`,[id,user.id,owner,dto.category,dto.description,dto.clientOperationId]);
      if(!o) throw new ConflictException('Сообщение уже обрабатывается. Повторите запрос');
      await this.event(q,id,user,'OBSTACLE_REPORTED',{id:o.id,category:dto.category});return o;
    });
  }
  async obstacleAction(id:number,dto:ObstacleActionDto,user:User) {
    return this.db.transaction(async q=>{
      const [o]=await q.query('SELECT * FROM work_obstacles WHERE id=$1 FOR UPDATE',[id]); if(!o) throw new NotFoundException('Препятствие не найдено');
      const t=await this.task(o.task_id,user,q); const manage=this.manages(t,user);
      if(dto.action==='assign') {
        if(!manage) throw new ForbiddenException('Назначение доступно руководителю');
        if(!['OPEN','WORKING'].includes(o.status) || !dto.ownerId || !dto.dueAt) throw new BadRequestException('Укажите ответственного и срок для открытого препятствия');
        await this.candidate(dto.ownerId,t,q,false);
        await q.query("UPDATE work_obstacles SET owner_id=$2,due_at=$3,status='WORKING' WHERE id=$1",[id,dto.ownerId,dto.dueAt]);
      } else if(dto.action==='resolve') {
        if(!manage && o.owner_id!==user.id) throw new ForbiddenException('Устранение подтверждает ответственный');
        if(!['OPEN','WORKING'].includes(o.status)) throw new BadRequestException('Препятствие уже отправлено на проверку');
        await q.query("UPDATE work_obstacles SET status='RESOLVED',resolution=$2,resolved_by_id=$3,resolved_at=now() WHERE id=$1",[id,dto.note,user.id]);
      } else {
        if(!manage && o.reporter_id!==user.id) throw new ForbiddenException('Результат проверяет заявитель или руководитель');
        if(o.status!=='RESOLVED') throw new BadRequestException('Сначала нужно устранить препятствие');
        if(dto.action==='verify' && o.resolved_by_id===user.id) throw new ForbiddenException('Попросите другого участника проверить устранение');
        await q.query(`UPDATE work_obstacles SET status=$2,verification=$3,closed_at=CASE WHEN $2='CLOSED' THEN now() ELSE NULL END,
          resolved_at=CASE WHEN $2='OPEN' THEN NULL ELSE resolved_at END WHERE id=$1`,[id,dto.action==='verify'?'CLOSED':'OPEN',dto.note]);
      }
      await this.event(q,t.id,user,`OBSTACLE_${dto.action.toUpperCase()}`,{id,note:dto.note,ownerId:dto.ownerId,dueAt:dto.dueAt});
      return (await q.query('SELECT * FROM work_obstacles WHERE id=$1',[id]))[0];
    });
  }
  async propose(id:number,dto:ImprovementDto,user:User) {
    return this.db.transaction(async q=>{
      await this.task(id,user,q);
      if(dto.obstacleId && !(await q.query('SELECT id FROM work_obstacles WHERE id=$1 AND task_id=$2',[dto.obstacleId,id])).length) throw new BadRequestException('Препятствие относится к другой задаче');
      const [existing]=await q.query('SELECT * FROM work_improvements WHERE client_operation_id=$1',[dto.clientOperationId]);
      if(existing) {
        if(existing.task_id!==id||existing.proposer_id!==user.id||existing.problem!==dto.problem||existing.proposal!==dto.proposal||existing.obstacle_id!==(dto.obstacleId??null)) throw new ConflictException('Идентификатор предложения уже использован');
        return existing;
      }
      const [i]=await q.query(`INSERT INTO work_improvements(task_id,obstacle_id,proposer_id,problem,proposal,client_operation_id)
        VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT(client_operation_id) DO NOTHING RETURNING *`,[id,dto.obstacleId??null,user.id,dto.problem,dto.proposal,dto.clientOperationId]);
      if(!i) throw new ConflictException('Предложение уже обрабатывается. Повторите запрос');
      await this.event(q,id,user,'IMPROVEMENT_PROPOSED',{id:i.id});return i;
    });
  }
  async improvementAction(id:number,dto:ImprovementActionDto,user:User) {
    return this.db.transaction(async q=>{
      const [i]=await q.query('SELECT * FROM work_improvements WHERE id=$1 FOR UPDATE',[id]);if(!i) throw new NotFoundException('Предложение не найдено');
      const t=await this.task(i.task_id,user,q);const manage=this.manages(t,user);
      if(dto.action==='plan') {
        if(!manage) throw new ForbiddenException('Проверку предложения назначает руководитель');
        if(i.status!=='PROPOSED'||!dto.ownerId||!dto.dueAt||!dto.hypothesis||!dto.metric||!dto.unit||!dto.direction||dto.baseline==null) throw new BadRequestException('Нужны ответственный, срок, гипотеза, показатель, единица и исходное значение');
        await this.candidate(dto.ownerId,t,q,false);
        await q.query("UPDATE work_improvements SET status='TESTING',owner_id=$2,due_at=$3,hypothesis=$4,metric=$5,unit=$6,direction=$7,baseline=$8,decision=$9,updated_at=now() WHERE id=$1",[id,dto.ownerId,dto.dueAt,dto.hypothesis,dto.metric,dto.unit,dto.direction,dto.baseline,dto.note]);
      } else if(dto.action==='measure') {
        if(!manage&&i.owner_id!==user.id) throw new ForbiddenException('Результат вносит ответственный');
        if(i.status!=='TESTING'||dto.observed==null) throw new BadRequestException('Нужно измеренное значение для начатой проверки');
        await q.query("UPDATE work_improvements SET status='CHECKING',observed=$2,evidence=$3,updated_at=now() WHERE id=$1",[id,dto.observed,dto.note]);
      } else if(dto.action==='adopt') {
        if(!this.global(user)) throw new ForbiddenException('Новую общую инструкцию утверждает директор');
        if(i.status!=='CHECKING'||i.owner_id===user.id||!dto.adoptionRule) throw new BadRequestException('Нужны независимая проверка результата и новое правило');
        if(!improved(i.baseline,i.observed,i.direction)) throw new BadRequestException('Измерение не подтверждает улучшение. Пересмотрите предложение');
        if(!t.work_type_id) throw new BadRequestException('У задачи нет вида работы');
        const p=await this.plan(t.id,q); if(!p) throw new BadRequestException('Сначала нужен стандарт, который будет улучшен');
        await q.query('SELECT id FROM work_types WHERE id=$1 FOR UPDATE',[t.work_type_id]);
        const [latest]=await q.query('SELECT * FROM work_standards WHERE work_type_id=$1 ORDER BY version DESC LIMIT 1',[t.work_type_id]);
        if(latest.id!==p.standard_id) throw new ConflictException('Стандарт уже изменился. Согласуйте новое предложение с актуальной версией');
        if(p.steps.length>=30) throw new BadRequestException('Стандарт достиг 30 пунктов. Сначала согласуйте сокращённую новую редакцию');
        const next=await this.insertStandard({workTypeId:t.work_type_id,title:p.title,steps:[...p.steps,dto.adoptionRule],preparation:p.preparation,acceptance:p.acceptance},user,q);
        await q.query("UPDATE work_improvements SET status='ADOPTED',decision=$2,checked_by_id=$3,adopted_standard_id=$4,updated_at=now() WHERE id=$1",[id,dto.note,user.id,next.id]);
      } else {
        if(!manage) throw new ForbiddenException('Решение принимает руководитель');
        if(['ADOPTED','REJECTED'].includes(i.status)) throw new BadRequestException('Решение уже принято');
        await q.query("UPDATE work_improvements SET status='REJECTED',decision=$2,checked_by_id=$3,updated_at=now() WHERE id=$1",[id,dto.note,user.id]);
      }
      await this.event(q,t.id,user,`IMPROVEMENT_${dto.action.toUpperCase()}`,{id,note:dto.note});return (await q.query('SELECT * FROM work_improvements WHERE id=$1',[id]))[0];
    });
  }
  async tools(user:User) {
    if(this.global(user)) return this.db.query('SELECT * FROM work_tools ORDER BY code');
    // Brigadiers may see storage tools, and tools assigned to their own brigade only.
    return this.db.query(`SELECT x.* FROM work_tools x LEFT JOIN tasks t ON t.id=x.task_id
      WHERE (x.task_id IS NULL AND $3=true) OR t.assignee_user_id=$1 OR t.brigade_id=$2 OR (t.created_by_id=$1 AND $4=true) ORDER BY x.code`,[user.id,user.brigadeId??-1,user.role==='BRIGADIER',user.role==='AGRONOMIST']);
  }
  async addTool(dto:ToolDto,user:User) {
    if(!this.global(user)) throw new ForbiddenException('Инструмент регистрирует руководитель компании');
    return this.db.transaction(async q=>{
      const [tool]=await q.query(`INSERT INTO work_tools(code,name,home_location,current_location) VALUES($1,$2,$3,$3) ON CONFLICT(code) DO NOTHING RETURNING *`,[dto.code,dto.name,dto.homeLocation]);
      if(!tool) throw new ConflictException('Инвентарный номер уже используется');
      await this.event(q,null,user,'TOOL_REGISTERED',{id:tool.id});return tool;
    });
  }
  async toolAction(id:number,dto:ToolActionDto,user:User) {
    return this.db.transaction(async q=>{
      const [tool]=await q.query('SELECT * FROM work_tools WHERE id=$1 FOR UPDATE',[id]);if(!tool) throw new NotFoundException('Инструмент не найден');
      const t=tool.task_id?await this.task(tool.task_id,user,q):null;
      const store=this.global(user)||user.role==='BRIGADIER';
      if(dto.action==='issue') {
        if(!store||!dto.taskId) throw new ForbiddenException('Выдача доступна директору или бригадиру');
        const target=await this.task(dto.taskId,user,q);this.assertManager(target,user);
        if(closed.includes(target.status)) throw new BadRequestException('Задача уже сдана или закрыта');
        if(tool.state!=='READY'||!tool.checked_at||businessDateString(new Date(tool.checked_at))!==businessDateString()) throw new BadRequestException('Перед выдачей подтвердите исправность и чистоту сегодня');
        await q.query("UPDATE work_tools SET state='ISSUED',task_id=$2,current_location=$3,updated_at=now() WHERE id=$1",[id,target.id,`${target.object_name} / ${target.section_name}`]);
      } else if(dto.action==='return') {
        if(!t||tool.state!=='ISSUED') throw new BadRequestException('Инструмент не выдан');
        if(!store&&!this.executes(t,user)) throw new ForbiddenException('Возврат доступен получателю');
        if(dto.serviceable==null||dto.clean==null||!dto.location) throw new BadRequestException('Укажите состояние, чистоту и место возврата');
        const ready=dto.serviceable&&dto.clean&&dto.location===tool.home_location;
        await q.query("UPDATE work_tools SET state=$2,task_id=NULL,current_location=$3,condition_note=$4,checked_at=now(),checked_by_id=$5,updated_at=now() WHERE id=$1",[id,ready?'READY':'MAINTENANCE',dto.location,dto.note,user.id]);
      } else if(dto.action==='inspect') {
        if(!store) throw new ForbiddenException('Проверка хранения доступна руководителю склада');
        if(['ISSUED','RETIRED'].includes(tool.state)) throw new BadRequestException('Сначала верните инструмент; списанный инструмент не восстанавливается');
        if(dto.serviceable==null||dto.clean==null||!dto.location) throw new BadRequestException('Укажите состояние, чистоту и место хранения');
        const ready=dto.serviceable&&dto.clean&&dto.location===tool.home_location;
        await q.query('UPDATE work_tools SET state=$2,current_location=$3,condition_note=$4,checked_at=now(),checked_by_id=$5,updated_at=now() WHERE id=$1',[id,ready?'READY':'MAINTENANCE',dto.location,dto.note,user.id]);
      } else {
        if(!this.global(user)||tool.task_id) throw new ForbiddenException('Списать можно только возвращённый инструмент с разрешения директора');
        await q.query("UPDATE work_tools SET state='RETIRED',condition_note=$2,updated_at=now() WHERE id=$1",[id,dto.note]);
      }
      await this.event(q,(dto.action==='issue'?dto.taskId:tool.task_id)??null,user,`TOOL_${dto.action.toUpperCase()}`,{id,...dto});return (await q.query('SELECT * FROM work_tools WHERE id=$1',[id]))[0];
    });
  }
  async board(user:User) {
    const tasks=await this.db.query(`${this.taskSelect} WHERE $3=true OR t.assignee_user_id=$1 OR t.brigade_id=$2 OR (t.created_by_id=$1 AND $4=true) ORDER BY t.due_date NULLS LAST,t.id DESC`,[user.id,user.brigadeId??-1,this.global(user),user.role==='AGRONOMIST']);
    const ids=tasks.map((t:TaskRow)=>t.id);if(!ids.length)return [];
    const plans=await this.db.query('SELECT p.task_id,p.ready_at,a.full_name accountable_name,r.full_name reviewer_name FROM work_task_plans p JOIN users a ON a.id=p.accountable_id JOIN users r ON r.id=p.reviewer_id WHERE task_id=ANY($1::int[])',[ids]);
    const blocked=await this.db.query("SELECT task_id,count(*)::int count FROM work_obstacles WHERE task_id=ANY($1::int[]) AND status<>'CLOSED' GROUP BY task_id",[ids]);
    const executions=await this.db.query('SELECT task_id,id FROM work_executions WHERE task_id=ANY($1::int[])',[ids]);
    return tasks.map((t:TaskRow)=>{
      const p=plans.find((p:{task_id:number})=>p.task_id===t.id);const obstacleCount=blocked.find((b:{task_id:number})=>b.task_id===t.id)?.count??0;
      const stage=t.status==='CANCELLED'?'CANCELLED':t.status==='VERIFIED'?'DONE':t.status==='COMPLETED'?'REVIEW':obstacleCount?'BLOCKED':t.status==='REJECTED'?'REWORK':t.status==='IN_PROGRESS'?'WORKING':p?.ready_at?'READY':'PLANNED';
      return {id:t.id,description:t.description,objectName:t.object_name,sectionName:t.section_name,status:t.status,stage,obstacleCount,
        assigneeName:(t as TaskRow&{assignee_name:string}).assignee_name,accountableName:p?.accountable_name??null,reviewerName:p?.reviewer_name??null,
        executionId:executions.find((e:{task_id:number})=>e.task_id===t.id)?.id??null,configured:!!p};
    });
  }
  async summary(user:User) {
    const since=new Date(Date.now()-30*86400000);const now=new Date();
    if(user.role==='ACCOUNTANT') {
      const financial=await this.db.query(`SELECT id,metric,unit,baseline,observed,status,evidence,decision FROM work_improvements WHERE unit='тг' AND status IN ('CHECKING','ADOPTED') AND updated_at >= $1 ORDER BY id DESC`,[since]);
      return {financial,periodDays:30};
    }
    const board=await this.board(user);const ids=board.map((t:{id:number})=>t.id);
    const obstacles=ids.length?await this.db.query('SELECT task_id,category,created_at,closed_at,status,due_at FROM work_obstacles WHERE task_id=ANY($1::int[]) AND (closed_at IS NULL OR closed_at >= $2)',[ids,since]):[];
    const ranking=waitingByCategory(obstacles,now,since);
    const improvements=ids.length?await this.db.query('SELECT id,status,metric,unit,baseline,observed FROM work_improvements WHERE task_id=ANY($1::int[])',[ids]):[];
    return {periodDays:30,asOf:now.toISOString(),counts:Object.fromEntries(['PLANNED','READY','WORKING','BLOCKED','REVIEW','REWORK','DONE','CANCELLED'].map(s=>[s,board.filter((t:{stage:string})=>t.stage===s).length])),
      waitingByCategory:ranking,overdueObstacles:obstacles.filter((o:{status:string;due_at:Date|null})=>o.status!=='CLOSED'&&o.due_at&&new Date(o.due_at)<now).length,
      improvements,interpretation:'Минуты препятствий по задачам за 30 дней. Пересечения одной причины в одной задаче объединены; причины могут пересекаться. Это не табель и не доказательство ограничения производительности.'};
  }
}
