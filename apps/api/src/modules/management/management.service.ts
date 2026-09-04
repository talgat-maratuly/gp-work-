import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, Repository } from 'typeorm';
import {
  businessDateString,
  businessPeriodRange,
  type BusinessPeriod,
} from '../../common/business-date';
import { parsePhotoUrls } from '../../common/photo-urls';
import {
  DecisionPriority,
  DecisionStatus,
} from '../../common/enums/decision.enums';
import { ScheduleStatus } from '../../common/enums/schedule-status.enum';
import { TaskStatus } from '../../common/enums/task-status.enum';
import { WateringStatus } from '../../common/enums/watering.enums';
import { ManagementDecision } from '../../entities/management-decision.entity';
import { ScheduleEntry } from '../../entities/schedule-entry.entity';
import { Task } from '../../entities/task.entity';
import { User } from '../../entities/user.entity';
import { WateringRecord } from '../../entities/watering-record.entity';
import { CreateDecisionDto } from './dto/create-decision.dto';
import { UpdateDecisionDto } from './dto/update-decision.dto';

export interface DecisionHistoryEntry {
  status: DecisionStatus;
  byId: number | null;
  byName: string | null;
  at: string;
  comment?: string | null;
}

function mapUser(user: User | null) {
  if (!user) return null;
  return { id: user.id, fullName: user.fullName, role: user.role };
}

function pct(part: number, whole: number): number {
  if (!whole) return 0;
  return Math.round((part / whole) * 100);
}

const CLOSED = [TaskStatus.COMPLETED, TaskStatus.VERIFIED];

@Injectable()
export class ManagementService {
  constructor(
    @InjectRepository(ManagementDecision)
    private readonly decisionRepo: Repository<ManagementDecision>,
    @InjectRepository(Task)
    private readonly taskRepo: Repository<Task>,
    @InjectRepository(WateringRecord)
    private readonly wateringRepo: Repository<WateringRecord>,
    @InjectRepository(ScheduleEntry)
    private readonly scheduleRepo: Repository<ScheduleEntry>,
  ) {}

  // ---------- РЕШЕНИЯ И СРОКИ ----------

  private parseHistory(raw: string): DecisionHistoryEntry[] {
    try {
      const parsed = JSON.parse(raw || '[]');
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  private mapDecision(row: ManagementDecision) {
    return {
      id: row.id,
      title: row.title,
      description: row.description,
      responsibleUserId: row.responsibleUserId,
      dueDate: row.dueDate,
      priority: row.priority,
      status: row.status,
      comment: row.comment,
      linkedTaskId: row.linkedTaskId,
      statusHistory: this.parseHistory(row.statusHistory),
      createdById: row.createdById,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      responsible: mapUser(row.responsible),
      createdBy: mapUser(row.createdBy),
    };
  }

  async findDecisions() {
    const rows = await this.decisionRepo.find({
      relations: ['responsible', 'createdBy'],
      order: { createdAt: 'DESC' },
    });
    return rows.map((r) => this.mapDecision(r));
  }

  async findDecision(id: number) {
    const row = await this.decisionRepo.findOne({
      where: { id },
      relations: ['responsible', 'createdBy'],
    });
    if (!row) throw new NotFoundException('Решение не найдено');
    return this.mapDecision(row);
  }

  private pushDecisionHistory(
    row: ManagementDecision,
    user: User,
    comment?: string | null,
  ) {
    const history = this.parseHistory(row.statusHistory);
    history.push({
      status: row.status,
      byId: user.id,
      byName: user.fullName,
      at: new Date().toISOString(),
      comment: comment ?? null,
    });
    row.statusHistory = JSON.stringify(history);
  }

  async createDecision(dto: CreateDecisionDto, user: User) {
    const row = this.decisionRepo.create({
      title: dto.title.trim(),
      description: dto.description?.trim() || null,
      responsibleUserId: dto.responsibleUserId ?? null,
      dueDate: dto.dueDate ?? null,
      priority: dto.priority ?? DecisionPriority.MEDIUM,
      status: dto.status ?? DecisionStatus.OPEN,
      comment: dto.comment?.trim() || null,
      linkedTaskId: dto.linkedTaskId ?? null,
      statusHistory: '[]',
      createdById: user.id,
    });
    this.pushDecisionHistory(row, user, 'Решение создано');
    const saved = await this.decisionRepo.save(row);
    return this.findDecision(saved.id);
  }

  async updateDecision(id: number, dto: UpdateDecisionDto, user: User) {
    const row = await this.decisionRepo.findOne({ where: { id } });
    if (!row) throw new NotFoundException('Решение не найдено');
    const statusChanged = dto.status !== undefined && dto.status !== row.status;

    if (dto.title !== undefined) row.title = dto.title.trim();
    if (dto.description !== undefined)
      row.description = dto.description?.trim() || null;
    if (dto.responsibleUserId !== undefined)
      row.responsibleUserId = dto.responsibleUserId;
    if (dto.dueDate !== undefined) row.dueDate = dto.dueDate;
    if (dto.priority !== undefined) row.priority = dto.priority;
    if (dto.status !== undefined) row.status = dto.status;
    if (dto.comment !== undefined) row.comment = dto.comment?.trim() || null;
    if (dto.linkedTaskId !== undefined) row.linkedTaskId = dto.linkedTaskId;

    if (statusChanged) this.pushDecisionHistory(row, user, dto.comment ?? null);
    await this.decisionRepo.save(row);
    return this.findDecision(id);
  }

  async removeDecision(id: number) {
    const row = await this.decisionRepo.findOne({ where: { id } });
    if (!row) throw new NotFoundException('Решение не найдено');
    await this.decisionRepo.remove(row);
  }

  // ---------- СВОДКА (OVERVIEW) ----------

  private computeRange(period: string, dateStr?: string) {
    if (!['day', 'week', 'month'].includes(period)) {
      throw new BadRequestException('Период должен быть day, week или month');
    }
    try {
      return {
        ...businessPeriodRange(period as BusinessPeriod, dateStr || businessDateString()),
        period,
      };
    } catch {
      throw new BadRequestException('Дата должна существовать и иметь формат YYYY-MM-DD');
    }
  }

  async overview(period = 'day', dateStr?: string) {
    const range = this.computeRange(period, dateStr);
    const today = businessDateString();

    // Задачи периода с деталями
    const tasks = await this.taskRepo
      .createQueryBuilder('task')
      .leftJoinAndSelect('task.section', 'section')
      .leftJoinAndSelect('section.object', 'object')
      .leftJoinAndSelect('task.workType', 'workType')
      .leftJoinAndSelect('task.assignee', 'assignee')
      .leftJoinAndSelect('task.brigade', 'brigade')
      .where('task.due_date BETWEEN :from AND :to', {
        from: range.from,
        to: range.to,
      })
      .orderBy('task.due_date', 'DESC')
      .getMany();

    const isClosed = (s: TaskStatus) => CLOSED.includes(s);
    const tasksTotal = tasks.length;
    const closed = tasks.filter((t) => isClosed(t.status)).length;
    const inProgress = tasks.filter(
      (t) => t.status === TaskStatus.IN_PROGRESS,
    ).length;
    const needsReview = tasks.filter(
      (t) => t.status === TaskStatus.COMPLETED,
    ).length;
    const verified = tasks.filter((t) => t.status === TaskStatus.VERIFIED).length;
    const rejected = tasks.filter((t) => t.status === TaskStatus.REJECTED).length;
    const overdue = tasks.filter(
      (t) => t.dueDate != null && t.dueDate < today && !isClosed(t.status),
    ).length;
    const completedTasks = tasks.filter((t) => isClosed(t.status));
    const withPhoto = completedTasks.filter(
      (t) => parsePhotoUrls(t.completionPhotoUrls).length > 0,
    ).length;
    const withoutPhoto = completedTasks.length - withPhoto;

    // Полив периода
    const watering = await this.wateringRepo.find({
      where: { workDate: Between(range.from, range.to) },
    });
    const wPlanned = watering.reduce((s, w) => s + (w.plannedLiters ?? 0), 0);
    const wActual = watering.reduce((s, w) => s + (w.actualLiters ?? 0), 0);
    const wDone = watering.filter((w) => w.status === WateringStatus.DONE).length;
    const wWithoutActual = watering.filter(
      (w) => w.actualLiters == null && w.status !== WateringStatus.PLANNED,
    ).length;
    const wBigDiff = watering.filter(
      (w) =>
        w.plannedLiters != null &&
        w.actualLiters != null &&
        w.plannedLiters > 0 &&
        Math.abs(w.actualLiters - w.plannedLiters) / w.plannedLiters > 0.3,
    );

    // График периода
    const schedule = await this.scheduleRepo.find({
      where: { plannedDate: Between(range.from, range.to) },
    });
    const sTotal = schedule.length;
    const sDone = schedule.filter((s) => s.status === ScheduleStatus.DONE).length;

    // Решения (все активные)
    const decisions = await this.decisionRepo.find();
    const dTotal = decisions.length;
    const dDone = decisions.filter((d) => d.status === DecisionStatus.DONE).length;
    const dOverdue = decisions.filter(
      (d) =>
        d.dueDate != null &&
        d.dueDate < today &&
        d.status !== DecisionStatus.DONE &&
        d.status !== DecisionStatus.CANCELLED,
    ).length;

    // Исключения качества
    const qualityExceptions: {
      type: string;
      title: string;
      detail: string;
    }[] = [];
    for (const t of tasks) {
      if (t.dueDate != null && t.dueDate < today && !isClosed(t.status)) {
        qualityExceptions.push({
          type: 'TASK_OVERDUE',
          title: `Просроченная задача: ${t.description?.slice(0, 40) || '#' + t.id}`,
          detail: `Объект ${t.section?.object?.name ?? '—'} · срок ${t.dueDate}`,
        });
      }
      if (isClosed(t.status) && parsePhotoUrls(t.completionPhotoUrls).length === 0) {
        qualityExceptions.push({
          type: 'TASK_NO_PHOTO',
          title: `Задача без фото: ${t.description?.slice(0, 40) || '#' + t.id}`,
          detail: `Объект ${t.section?.object?.name ?? '—'}`,
        });
      }
    }
    for (const w of watering) {
      if (w.actualLiters == null && w.status !== WateringStatus.PLANNED) {
        qualityExceptions.push({
          type: 'WATERING_NO_ACTUAL',
          title: 'Полив без фактических литров',
          detail: `Дата ${w.workDate} · план ${w.plannedLiters ?? '—'} л`,
        });
      }
    }
    for (const w of wBigDiff) {
      qualityExceptions.push({
        type: 'WATERING_BIG_DIFF',
        title: 'Большое расхождение план/факт по поливу',
        detail: `Дата ${w.workDate} · план ${w.plannedLiters} / факт ${w.actualLiters} л`,
      });
    }

    // Исполнение и проверка (список задач)
    const executionReview = tasks.slice(0, 50).map((t) => ({
      taskId: t.id,
      description: t.description?.slice(0, 60) ?? '',
      objectName: t.section?.object?.name ?? '—',
      sectionName: t.section?.name ?? '—',
      workTypeName: t.workType?.name ?? null,
      assigneeName: t.assignee?.fullName ?? null,
      brigadeName: t.brigade?.name ?? null,
      status: t.status,
      photoCount: parsePhotoUrls(t.completionPhotoUrls).length,
      reviewComment: t.reviewComment,
    }));

    return {
      range,
      dailyReport: {
        tasksTotal,
        closed,
        inProgress,
        overdue,
        needsReview,
        objectsWithoutPhoto: withoutPhoto,
        wateringWithoutActual: wWithoutActual,
      },
      watering: {
        total: watering.length,
        done: wDone,
        plannedLiters: wPlanned,
        actualLiters: wActual,
        litersDiff: wActual - wPlanned,
      },
      schedule: { total: sTotal, done: sDone },
      decisions: { total: dTotal, done: dDone, overdue: dOverdue },
      kpi: {
        qaPass: pct(verified, verified + needsReview + rejected),
        wateringExec: pct(wDone, watering.length),
        scheduleExec: pct(sDone, sTotal),
        decisionsExec: pct(dDone, dTotal),
        tasksWithPhoto: pct(withPhoto, completedTasks.length),
      },
      qualityExceptions,
      executionReview,
    };
  }
}
