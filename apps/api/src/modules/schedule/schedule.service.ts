import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, SelectQueryBuilder } from 'typeorm';
import { parsePhotoUrls } from '../../common/photo-urls';
import { ScheduleStatus } from '../../common/enums/schedule-status.enum';
import { ScheduleEntry } from '../../entities/schedule-entry.entity';
import { User } from '../../entities/user.entity';
import { CreateScheduleDto } from './dto/create-schedule.dto';
import { QueryScheduleDto } from './dto/query-schedule.dto';
import { UpdateScheduleDto } from './dto/update-schedule.dto';

export interface HistoryEntry {
  status?: ScheduleStatus;
  action: string;
  byId: number | null;
  byName: string | null;
  at: string;
  comment?: string | null;
}

function mapUser(user: User | null) {
  if (!user) return null;
  return { id: user.id, fullName: user.fullName, role: user.role };
}

function nextMonthFirst(month: string): string {
  const [y, m] = month.split('-').map(Number);
  if (!y || !m) return month;
  return m >= 12
    ? `${y + 1}-01-01`
    : `${y}-${String(m + 1).padStart(2, '0')}-01`;
}

@Injectable()
export class ScheduleService {
  constructor(
    @InjectRepository(ScheduleEntry)
    private readonly scheduleRepo: Repository<ScheduleEntry>,
  ) {}

  private baseQuery(): SelectQueryBuilder<ScheduleEntry> {
    return this.scheduleRepo
      .createQueryBuilder('s')
      .leftJoinAndSelect('s.object', 'object')
      .leftJoinAndSelect('s.section', 'section')
      .leftJoinAndSelect('section.object', 'sectionObject')
      .leftJoinAndSelect('s.workType', 'workType')
      .leftJoinAndSelect('s.brigade', 'brigade')
      .leftJoinAndSelect('s.assignee', 'assignee')
      .leftJoinAndSelect('s.task', 'task')
      .leftJoinAndSelect('s.createdBy', 'createdBy');
  }

  private parseHistory(raw: string): HistoryEntry[] {
    try {
      const parsed = JSON.parse(raw || '[]');
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  private pushHistory(
    row: ScheduleEntry,
    action: string,
    user: User,
    comment?: string | null,
  ) {
    const history = this.parseHistory(row.statusHistory);
    history.push({
      status: row.status,
      action,
      byId: user.id,
      byName: user.fullName,
      at: new Date().toISOString(),
      comment: comment ?? null,
    });
    row.statusHistory = JSON.stringify(history);
  }

  private mapEntry(row: ScheduleEntry) {
    const taskPhotos = row.task ? parsePhotoUrls(row.task.completionPhotoUrls) : [];
    return {
      id: row.id,
      plannedDate: row.plannedDate,
      objectId: row.objectId,
      sectionId: row.sectionId,
      workTypeId: row.workTypeId,
      brigadeId: row.brigadeId,
      assigneeUserId: row.assigneeUserId,
      taskId: row.taskId,
      status: row.status,
      rescheduleReason: row.rescheduleReason,
      comment: row.comment,
      statusHistory: this.parseHistory(row.statusHistory),
      createdById: row.createdById,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      objectName: row.object?.name ?? row.section?.object?.name ?? null,
      sectionName: row.section?.name ?? null,
      sectionCode: row.section?.code ?? null,
      workTypeName: row.workType?.name ?? null,
      brigadeName: row.brigade?.name ?? null,
      object: row.object ? { id: row.object.id, name: row.object.name } : null,
      workType: row.workType ? { id: row.workType.id, name: row.workType.name } : null,
      brigade: row.brigade ? { id: row.brigade.id, name: row.brigade.name } : null,
      assignee: mapUser(row.assignee),
      createdBy: mapUser(row.createdBy),
      task: row.task
        ? {
            id: row.task.id,
            status: row.task.status,
            dueDate: row.task.dueDate,
            completedAt: row.task.completedAt,
            photoUrls: taskPhotos,
            photoCount: taskPhotos.length,
            latitude: null as number | null,
            longitude: null as number | null,
          }
        : null,
      // Гео берём с участка (там хранится точка + радиус)
      latitude: row.section?.latitude ?? null,
      longitude: row.section?.longitude ?? null,
    };
  }

  private applyFilters(
    qb: SelectQueryBuilder<ScheduleEntry>,
    query: QueryScheduleDto,
  ) {
    if (query.month) {
      const from = `${query.month}-01`;
      const to = nextMonthFirst(query.month);
      qb.andWhere('s.planned_date >= :from AND s.planned_date < :to', { from, to });
    }
    if (query.dateFrom) qb.andWhere('s.planned_date >= :df', { df: query.dateFrom });
    if (query.dateTo) qb.andWhere('s.planned_date <= :dt', { dt: query.dateTo });
    if (query.objectId) {
      qb.andWhere('(s.object_id = :oid OR section.object_id = :oid)', {
        oid: query.objectId,
      });
    }
    if (query.brigadeId) qb.andWhere('s.brigade_id = :bid', { bid: query.brigadeId });
    if (query.assigneeUserId)
      qb.andWhere('s.assignee_user_id = :aid', { aid: query.assigneeUserId });
    if (query.workTypeId)
      qb.andWhere('s.work_type_id = :wid', { wid: query.workTypeId });
    if (query.status) qb.andWhere('s.status = :st', { st: query.status });
    return qb;
  }

  async findAll(query: QueryScheduleDto) {
    const qb = this.applyFilters(this.baseQuery(), query)
      .orderBy('s.planned_date', 'ASC')
      .addOrderBy('s.id', 'ASC');
    const rows = await qb.getMany();
    return rows.map((r) => this.mapEntry(r));
  }

  async findOne(id: number) {
    const row = await this.baseQuery().where('s.id = :id', { id }).getOne();
    if (!row) throw new NotFoundException('Запись графика не найдена');
    return this.mapEntry(row);
  }

  async create(dto: CreateScheduleDto, user: User) {
    const row = this.scheduleRepo.create({
      plannedDate: dto.plannedDate,
      objectId: dto.objectId ?? null,
      sectionId: dto.sectionId ?? null,
      workTypeId: dto.workTypeId ?? null,
      brigadeId: dto.brigadeId ?? null,
      assigneeUserId: dto.assigneeUserId ?? null,
      taskId: dto.taskId ?? null,
      status: dto.status ?? ScheduleStatus.PLANNED,
      comment: dto.comment?.trim() || null,
      statusHistory: '[]',
      createdById: user.id,
    });
    this.pushHistory(row, 'Создано', user, 'Запись графика создана');
    const saved = await this.scheduleRepo.save(row);
    return this.findOne(saved.id);
  }

  async update(id: number, dto: UpdateScheduleDto, user: User) {
    const row = await this.scheduleRepo.findOne({ where: { id } });
    if (!row) throw new NotFoundException('Запись графика не найдена');

    const dateChanged =
      dto.plannedDate !== undefined && dto.plannedDate !== row.plannedDate;
    const statusChanged = dto.status !== undefined && dto.status !== row.status;
    const oldDate = row.plannedDate;

    if (dto.plannedDate !== undefined) row.plannedDate = dto.plannedDate;
    if (dto.objectId !== undefined) row.objectId = dto.objectId;
    if (dto.sectionId !== undefined) row.sectionId = dto.sectionId;
    if (dto.workTypeId !== undefined) row.workTypeId = dto.workTypeId;
    if (dto.brigadeId !== undefined) row.brigadeId = dto.brigadeId;
    if (dto.assigneeUserId !== undefined) row.assigneeUserId = dto.assigneeUserId;
    if (dto.taskId !== undefined) row.taskId = dto.taskId;
    if (dto.status !== undefined) row.status = dto.status;
    if (dto.rescheduleReason !== undefined)
      row.rescheduleReason = dto.rescheduleReason?.trim() || null;
    if (dto.comment !== undefined) row.comment = dto.comment?.trim() || null;

    if (dateChanged) {
      this.pushHistory(
        row,
        'Перенос даты',
        user,
        `${oldDate} → ${row.plannedDate}${
          dto.rescheduleReason ? ` (${dto.rescheduleReason})` : ''
        }`,
      );
    }
    if (statusChanged) {
      this.pushHistory(row, 'Смена статуса', user, dto.rescheduleReason ?? null);
    }

    await this.scheduleRepo.save(row);
    return this.findOne(id);
  }

  async remove(id: number) {
    const row = await this.scheduleRepo.findOne({ where: { id } });
    if (!row) throw new NotFoundException('Запись графика не найдена');
    await this.scheduleRepo.remove(row);
  }
}
