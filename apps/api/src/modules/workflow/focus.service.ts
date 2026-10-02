import { BadRequestException, ConflictException, Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { User } from '../../entities';
import { businessDateString } from '../../common/business-date';
import { WorkflowService } from './workflow.service';
import { FocusDto } from './focus.dto';
@Injectable()
export class FocusService {
  constructor(private readonly db: DataSource, private readonly workflow: WorkflowService) {}
  async list(user: User, mine = false) {
    const board = await this.workflow.board(user);
    const ids = board.map(t => t.id);
    if (!ids.length) return [];
    return this.db.query(`SELECT f.*, t.description, t.status, t.assignee_user_id, t.due_date,
      u.full_name assignee_name,
      (SELECT count(*)::int FROM work_task_focus_history h WHERE h.task_id=f.task_id AND h.before_value IS NOT NULL
        AND (h.before_value->>'start_at' IS DISTINCT FROM h.after_value->>'start_at'
          OR h.before_value->>'end_at' IS DISTINCT FROM h.after_value->>'end_at')) reschedules
      FROM work_task_focus f JOIN tasks t ON t.id=f.task_id LEFT JOIN users u ON u.id=t.assignee_user_id
      WHERE f.task_id=ANY($1::int[]) AND ($2=false OR t.assignee_user_id=$3)
      ORDER BY f.start_at,f.task_id`, [ids, mine, user.id]);
  }
  async detail(id: number, user: User) {
    await this.workflow.task(id, user);
    const [plan] = await this.db.query('SELECT * FROM work_task_focus WHERE task_id=$1', [id]);
    const history = await this.db.query(`SELECT h.*, u.full_name actor_name FROM work_task_focus_history h
      JOIN users u ON u.id=h.actor_id WHERE h.task_id=$1 ORDER BY h.id DESC`, [id]);
    return { plan: plan ?? null, history };
  }
  async save(id: number, dto: FocusDto, user: User) {
    const start = new Date(dto.startAt), end = new Date(dto.endAt);
    if (!Number.isFinite(+start) || !Number.isFinite(+end) || end <= start)
      throw new BadRequestException('Время окончания должно быть позже начала');
    await this.db.transaction(async q => {
      await q.query('SELECT id FROM tasks WHERE id=$1 FOR UPDATE', [id]);
      const task = await this.workflow.managedTask(id, user, q);
      if (['COMPLETED','VERIFIED','CANCELLED'].includes(task.status))
        throw new BadRequestException('План закрытой задачи сохраняется в истории и не изменяется');
      if (!task.assignee_user_id) throw new BadRequestException('Сначала назначьте исполнителя задачи');
      const [{due_date: dueDate}] = await q.query('SELECT due_date::text FROM tasks WHERE id=$1', [id]);
      if (dueDate && businessDateString(end) > dueDate)
        throw new BadRequestException('Плановое время выходит за крайний срок задачи');
      // All reservations for one executor serialize, including different tasks.
      await q.query('SELECT pg_advisory_xact_lock(7340,$1)', [task.assignee_user_id]);
      const [old] = await q.query('SELECT * FROM work_task_focus WHERE task_id=$1', [id]);
      if ((old?.version ?? 0) !== dto.version)
        throw new ConflictException('План уже изменён. Обновите карточку перед сохранением');
      if (old && !dto.reason.trim()) throw new BadRequestException('Укажите причину изменения плана');
      const conflict = await q.query(`SELECT f.task_id FROM work_task_focus f JOIN tasks t ON t.id=f.task_id
        WHERE t.assignee_user_id=$1 AND t.id<>$2 AND t.status NOT IN ('COMPLETED','VERIFIED','CANCELLED')
        AND f.start_at<$4 AND f.end_at>$3 LIMIT 1`, [task.assignee_user_id,id,start,end]);
      if (conflict.length) throw new ConflictException('У исполнителя уже есть работа на это время');
      if (dto.improvementId != null) {
        const [improvement] = await q.query('SELECT task_id FROM work_improvements WHERE id=$1', [dto.improvementId]);
        if (!improvement) throw new BadRequestException('Предложение не найдено');
        await this.workflow.managedTask(improvement.task_id, user, q);
      }
      const [saved] = await q.query(`INSERT INTO work_task_focus(task_id,important,urgent,outcome,start_at,end_at,improvement_id)
        VALUES($1,$2,$3,$4,$5,$6,$7) ON CONFLICT(task_id) DO UPDATE SET
        important=EXCLUDED.important,urgent=EXCLUDED.urgent,outcome=EXCLUDED.outcome,
        start_at=EXCLUDED.start_at,end_at=EXCLUDED.end_at,improvement_id=EXCLUDED.improvement_id,
        version=work_task_focus.version+1,updated_at=now() RETURNING *`,
        [id,dto.important,dto.urgent,dto.outcome,start,end,dto.improvementId ?? null]);
      await q.query(`INSERT INTO work_task_focus_history(task_id,actor_id,reason,before_value,after_value)
        VALUES($1,$2,$3,$4::jsonb,$5::jsonb)`,[id,user.id,dto.reason.trim() || 'План создан',old ? JSON.stringify(old) : null,JSON.stringify(saved)]);
    });
    return this.detail(id,user);
  }
}
