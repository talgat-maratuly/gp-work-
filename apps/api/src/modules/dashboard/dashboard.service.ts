import { Injectable } from '@nestjs/common';
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

  async summary(filters: DashboardFilters = {}) {
    const date = filters.date || businessDateString();
    const today = businessDateString();
    const period = filters.period || 'day';

    // Диапазон дат для KPI (переиспользуем оперативную сводку «Управления»)
    const overview = await this.managementService.overview(period, date);

    // ---- Карточки ----
    const objectsTotal = await this.objectRepo.count();
    const activeBrigades = await this.brigadeRepo.count({ where: { isActive: true } });
    const waterCarriers = await this.userRepo.count({
      where: { role: UserRole.WATER_CARRIER, isActive: true },
    });

    const sections = await this.sectionRepo.find();
    const totalAreaM2 = sections.reduce((s, sec) => s + parseArea(sec.area), 0);

    // Задачи сегодня
    const tasksTodayRows = await this.taskRepo
      .createQueryBuilder('task')
      .leftJoinAndSelect('task.section', 'section')
      .leftJoinAndSelect('section.object', 'object')
      .leftJoinAndSelect('task.assignee', 'assignee')
      .where('task.due_date = :date', { date })
      .orderBy('task.id', 'DESC')
      .getMany();

    const tasksToday = tasksTodayRows.length;
    const tasksDone = tasksTodayRows.filter((t) => CLOSED.includes(t.status)).length;
    const tasksInProgress = tasksTodayRows.filter(
      (t) => t.status === TaskStatus.IN_PROGRESS,
    ).length;
    const tasksNeedsReview = tasksTodayRows.filter(
      (t) => t.status === TaskStatus.COMPLETED,
    ).length;
    const tasksOverdue = await this.taskRepo
      .createQueryBuilder('task')
      .where('task.due_date < :today', { today })
      .andWhere('task.status NOT IN (:...closed)', { closed: CLOSED })
      .getCount();

    // Полив за дату
    const wateringToday = await this.wateringRepo.find({ where: { workDate: date } });
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
    const scheduleToday = await this.scheduleRepo.find({
      where: { plannedDate: date },
    });
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
      filters: { date, period },
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
