import { ForbiddenException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { businessDateString } from '../../common/business-date';
import { ScheduleStatus } from '../../common/enums/schedule-status.enum';
import { TaskStatus } from '../../common/enums/task-status.enum';
import { UserRole } from '../../common/enums/user-role.enum';
import {
  WateringShift,
  WateringStatus,
} from '../../common/enums/watering.enums';
import { Brigade } from '../../entities/brigade.entity';
import { NurseryObject } from '../../entities/nursery-object.entity';
import { ScheduleEntry } from '../../entities/schedule-entry.entity';
import { Section } from '../../entities/section.entity';
import { Task } from '../../entities/task.entity';
import { User } from '../../entities/user.entity';
import { WateringRecord } from '../../entities/watering-record.entity';
import { ManagementService } from '../management/management.service';

const CLOSED = [TaskStatus.COMPLETED, TaskStatus.VERIFIED];

// Извлекаем число из текстового поля площади ("40 000 м²" -> 40000)
function parseArea(area: string | null): number {
  if (!area) return 0;
  const digits = area.replace(/[^\d]/g, '');
  return digits ? Number(digits) : 0;
}

export interface DashboardFilters {
  date?: string;
  period?: string;
  objectId?: number;
  brigadeId?: number;
  shift?: WateringShift;
  createdById?: number;
}

@Injectable()
export class DashboardService {
  constructor(
    @InjectRepository(NurseryObject)
    private readonly objectRepo: Repository<NurseryObject>,
    @InjectRepository(Section)
    private readonly sectionRepo: Repository<Section>,
    @InjectRepository(Task)
    private readonly taskRepo: Repository<Task>,
    @InjectRepository(WateringRecord)
    private readonly wateringRepo: Repository<WateringRecord>,
    @InjectRepository(ScheduleEntry)
    private readonly scheduleRepo: Repository<ScheduleEntry>,
    @InjectRepository(Brigade)
    private readonly brigadeRepo: Repository<Brigade>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    private readonly managementService: ManagementService,
  ) {}

  private scopeFilters(filters: DashboardFilters, user: User): DashboardFilters {
    if (user.role === UserRole.BRIGADIER) {
      if (filters.brigadeId !== undefined && filters.brigadeId !== user.brigadeId) {
        throw new ForbiddenException('Бригадир может просматривать только свою бригаду');
      }
      return { ...filters, brigadeId: user.brigadeId ?? 0 };
    }
    if (user.role === UserRole.AGRONOMIST) {
      return { ...filters, createdById: user.id };
    }
    return filters;
  }

  async summary(requestedFilters: DashboardFilters = {}, user: User) {
    const filters = this.scopeFilters(requestedFilters, user);
    const date = filters.date || businessDateString();
    const today = businessDateString();
    const period = filters.period || 'day';

    // Диапазон дат для KPI (переиспользуем оперативную сводку «Управления»)
    const overview = await this.managementService.overview(period, date, filters);

    // ---- Карточки ----
    const objectQuery = this.objectRepo
      .createQueryBuilder('object')
      .where('object.is_active = true');
    if (filters.objectId !== undefined) objectQuery.andWhere('object.id = :objectId', { objectId: filters.objectId });
    const objectsTotal = await objectQuery.getCount();

    const brigadeQuery = this.brigadeRepo
      .createQueryBuilder('brigade')
      .where('brigade.is_active = true');
    if (filters.brigadeId !== undefined) brigadeQuery.andWhere('brigade.id = :brigadeId', { brigadeId: filters.brigadeId });
    const activeBrigades = await brigadeQuery.getCount();

    const waterCarriers = await this.userRepo.count({
      where: { role: UserRole.WATER_CARRIER, isActive: true },
    });

    const sectionQuery = this.sectionRepo
      .createQueryBuilder('section')
      .innerJoinAndSelect('section.object', 'object')
      .where('section.is_active = true')
      .andWhere('object.is_active = true');
    if (filters.objectId !== undefined) sectionQuery.andWhere('section.object_id = :objectId', { objectId: filters.objectId });
    const sections = await sectionQuery.getMany();
    const totalAreaM2 = sections.reduce((s, sec) => s + parseArea(sec.area), 0);

    // Задачи сегодня
    const tasksTodayQuery = this.taskRepo
      .createQueryBuilder('task')
      .leftJoinAndSelect('task.section', 'section')
      .leftJoinAndSelect('section.object', 'object')
      .leftJoinAndSelect('task.assignee', 'assignee')
      .where('task.due_date = :date', { date })
      .andWhere('task.status != :cancelled', { cancelled: TaskStatus.CANCELLED });
    if (filters.objectId !== undefined) {
      tasksTodayQuery.andWhere('section.object_id = :objectId', { objectId: filters.objectId });
    }
    if (filters.brigadeId !== undefined) {
      tasksTodayQuery.andWhere('task.brigade_id = :brigadeId', { brigadeId: filters.brigadeId });
    }
    if (filters.createdById !== undefined) {
      tasksTodayQuery.andWhere('task.created_by_id = :createdById', { createdById: filters.createdById });
    }
    const tasksTodayRows = await tasksTodayQuery.orderBy('task.id', 'DESC').getMany();

    const tasksToday = tasksTodayRows.length;
    const tasksDone = tasksTodayRows.filter((t) => CLOSED.includes(t.status)).length;
    const tasksInProgress = tasksTodayRows.filter(
      (t) => t.status === TaskStatus.IN_PROGRESS,
    ).length;
    const tasksNeedsReview = tasksTodayRows.filter(
      (t) => t.status === TaskStatus.COMPLETED,
    ).length;
    const overdueQuery = this.taskRepo
      .createQueryBuilder('task')
      .innerJoin('task.section', 'section')
      .where('task.due_date < :today', { today })
      .andWhere('task.status NOT IN (:...closed)', {
        closed: [...CLOSED, TaskStatus.CANCELLED],
      });
    if (filters.objectId !== undefined) overdueQuery.andWhere('section.object_id = :objectId', { objectId: filters.objectId });
    if (filters.brigadeId !== undefined) overdueQuery.andWhere('task.brigade_id = :brigadeId', { brigadeId: filters.brigadeId });
    if (filters.createdById !== undefined) overdueQuery.andWhere('task.created_by_id = :createdById', { createdById: filters.createdById });
    const tasksOverdue = await overdueQuery.getCount();

    // Полив за дату
    const wateringQuery = this.wateringRepo
      .createQueryBuilder('watering')
      .where('watering.work_date = :date', { date });
    if (filters.objectId !== undefined) wateringQuery.andWhere('watering.object_id = :objectId', { objectId: filters.objectId });
    if (filters.shift) wateringQuery.andWhere('watering.shift = :shift', { shift: filters.shift });
    const wateringToday = await wateringQuery.getMany();
    const wateringPlannedLiters = wateringToday.reduce(
      (s, w) => s + (w.plannedLiters ?? 0),
      0,
    );
    const wateringActualLiters = wateringToday.reduce(
      (s, w) => s + (w.actualLiters ?? 0),
      0,
    );

    // Объекты без подтверждённого полива (есть полив за дату, но не DONE)
    const objectsMap = new Map<number, boolean>();
    for (const w of wateringToday) {
      const objId = w.objectId ?? null;
      if (objId == null) continue;
      objectsMap.set(
        objId,
        (objectsMap.get(objId) ?? false) || w.status === WateringStatus.DONE,
      );
    }
    const objectsWithoutConfirmedWatering = Array.from(objectsMap.values()).filter(
      (ok) => !ok,
    ).length;

    // Ночной отчёт полива
    const nightRows = wateringToday.filter((w) => w.shift === WateringShift.NIGHT);
    const nightWatering = {
      polito: nightRows.filter((w) => w.status === WateringStatus.DONE).length,
      notPolito: nightRows.filter(
        (w) =>
          w.status === WateringStatus.PLANNED ||
          w.status === WateringStatus.SKIPPED,
      ).length,
      needsReview: nightRows.filter(
        (w) => w.status === WateringStatus.NEEDS_REVIEW,
      ).length,
      liters: nightRows.reduce((s, w) => s + (w.actualLiters ?? 0), 0),
    };

    // Производственный план за дату
    const scheduleQuery = this.scheduleRepo
      .createQueryBuilder('schedule')
      .where('schedule.planned_date = :date', { date });
    if (filters.objectId !== undefined) scheduleQuery.andWhere('schedule.object_id = :objectId', { objectId: filters.objectId });
    if (filters.brigadeId !== undefined) scheduleQuery.andWhere('schedule.brigade_id = :brigadeId', { brigadeId: filters.brigadeId });
    const scheduleToday = await scheduleQuery.getMany();
    const productionPlan = {
      total: scheduleToday.length,
      planned: scheduleToday.filter((s) => s.status === ScheduleStatus.PLANNED).length,
      inProgress: scheduleToday.filter(
        (s) => s.status === ScheduleStatus.IN_PROGRESS,
      ).length,
      done: scheduleToday.filter((s) => s.status === ScheduleStatus.DONE).length,
    };

    // Протоколы и контроль выполнения — последние решения
    const decisions = await this.managementService.findDecisions();

    return {
      filters: {
        date,
        period,
        objectId: filters.objectId ?? null,
        brigadeId: filters.brigadeId ?? null,
        shift: filters.shift ?? null,
      },
      cards: {
        objectsTotal,
        totalAreaM2,
        tasksToday,
        tasksDone,
        tasksInProgress,
        tasksOverdue,
        tasksNeedsReview,
        wateringPlannedLiters,
        wateringActualLiters,
        waterCarriers,
        activeBrigades,
        workCompletionPercent: overview.kpi ? overview.kpi.scheduleExec : 0,
        reviewPassPercent: overview.kpi ? overview.kpi.qaPass : 0,
        objectsWithoutConfirmedWatering,
      },
      tasksTodayList: tasksTodayRows.slice(0, 20).map((t) => ({
        id: t.id,
        description: t.description?.slice(0, 60) ?? '',
        objectName: t.section?.object?.name ?? '—',
        assigneeName: t.assignee?.fullName ?? null,
        status: t.status,
      })),
      nightWatering,
      productionPlan,
      kpi: overview.kpi,
      executionReview: overview.executionReview.slice(0, 15),
      qualityExceptions: overview.qualityExceptions,
      protocols: decisions.slice(0, 10).map((d) => ({
        id: d.id,
        title: d.title,
        status: d.status,
        dueDate: d.dueDate,
        responsible: d.responsible?.fullName ?? null,
      })),
    };
  }
}
