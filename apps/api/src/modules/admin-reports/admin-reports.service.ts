import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, LessThan, Not, Repository, SelectQueryBuilder } from 'typeorm';
import { parsePhotoUrls, serializePhotoUrls } from '../../common/photo-urls';
import { AdminReportStatus } from '../../common/enums/admin-report-status.enum';
import { TaskStatus } from '../../common/enums/task-status.enum';
import { UserRole } from '../../common/enums/user-role.enum';
import { WateringStatus } from '../../common/enums/watering.enums';
import { AdminDailyReport } from '../../entities/admin-daily-report.entity';
import { AttendanceRecord } from '../../entities/attendance-record.entity';
import { Task } from '../../entities/task.entity';
import { User } from '../../entities/user.entity';
import { WateringRecord } from '../../entities/watering-record.entity';
import { CreateAdminReportDto } from './dto/create-admin-report.dto';
import { QueryAdminReportDto } from './dto/query-admin-report.dto';
import { ReviewAdminReportDto } from './dto/review-admin-report.dto';
import { UpdateAdminReportDto } from './dto/update-admin-report.dto';

export interface HistoryEntry {
  status: AdminReportStatus;
  byId: number | null;
  byName: string | null;
  at: string;
  comment?: string | null;
}

function mapUser(user: User | null) {
  if (!user) return null;
  return { id: user.id, fullName: user.fullName, role: user.role };
}

const CLOSED_TASK_STATUSES = [TaskStatus.COMPLETED, TaskStatus.VERIFIED];

@Injectable()
export class AdminReportsService {
  constructor(
    @InjectRepository(AdminDailyReport)
    private readonly reportRepo: Repository<AdminDailyReport>,
    @InjectRepository(Task)
    private readonly taskRepo: Repository<Task>,
    @InjectRepository(WateringRecord)
    private readonly wateringRepo: Repository<WateringRecord>,
    @InjectRepository(AttendanceRecord)
    private readonly attendanceRepo: Repository<AttendanceRecord>,
  ) {}

  private baseQuery(): SelectQueryBuilder<AdminDailyReport> {
    return this.reportRepo
      .createQueryBuilder('r')
      .leftJoinAndSelect('r.author', 'author')
      .leftJoinAndSelect('r.reviewedBy', 'reviewedBy');
  }

  private parseHistory(raw: string): HistoryEntry[] {
    try {
      const parsed = JSON.parse(raw || '[]');
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  private mapReport(row: AdminDailyReport) {
    return {
      id: row.id,
      reportDate: row.reportDate,
      authorId: row.authorId,
      completedWorks: row.completedWorks,
      pendingWorks: row.pendingWorks,
      tasksInProgress: row.tasksInProgress,
      overdueTasks: row.overdueTasks,
      wateringDone: row.wateringDone,
      plannedLiters: row.plannedLiters,
      actualLiters: row.actualLiters,
      issues: row.issues,
      attentionObjects: row.attentionObjects,
      brigadesInfo: row.brigadesInfo,
      waterCarriersInfo: row.waterCarriersInfo,
      decisions: row.decisions,
      comment: row.comment,
      photoUrls: parsePhotoUrls(row.photoUrls),
      status: row.status,
      statusHistory: this.parseHistory(row.statusHistory),
      reviewedById: row.reviewedById,
      reviewedAt: row.reviewedAt,
      reviewComment: row.reviewComment,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      author: mapUser(row.author),
      reviewedBy: mapUser(row.reviewedBy),
    };
  }

  private pushHistory(
    row: AdminDailyReport,
    status: AdminReportStatus,
    user: User,
    comment?: string | null,
  ) {
    const history = this.parseHistory(row.statusHistory);
    history.push({
      status,
      byId: user.id,
      byName: user.fullName,
      at: new Date().toISOString(),
      comment: comment ?? null,
    });
    row.statusHistory = JSON.stringify(history);
  }

  async findAll(query: QueryAdminReportDto) {
    const qb = this.baseQuery()
      .orderBy('r.report_date', 'DESC')
      .addOrderBy('r.created_at', 'DESC');

    if (query.dateFrom) qb.andWhere('r.report_date >= :df', { df: query.dateFrom });
    if (query.dateTo) qb.andWhere('r.report_date <= :dt', { dt: query.dateTo });
    if (query.authorId) qb.andWhere('r.author_id = :aid', { aid: query.authorId });
    if (query.status) qb.andWhere('r.status = :st', { st: query.status });

    const rows = await qb.getMany();
    return rows.map((r) => this.mapReport(r));
  }

  async findOne(id: number) {
    const row = await this.baseQuery().where('r.id = :id', { id }).getOne();
    if (!row) throw new NotFoundException('Отчёт не найден');
    return this.mapReport(row);
  }

  /**
   * Авто-расчёт показателей за дату из существующих данных
   * (задачи, полив, табель) — без ручного ввода.
   */
  async aggregate(date: string) {
    if (!date) throw new BadRequestException('Не указана дата');

    const [
      tasksToday,
      closed,
      inProgress,
      needsReview,
      overdue,
      attendanceCount,
      wateringRows,
    ] = await Promise.all([
      this.taskRepo.count({ where: { dueDate: date } }),
      this.taskRepo.count({ where: { dueDate: date, status: In(CLOSED_TASK_STATUSES) } }),
      this.taskRepo.count({ where: { dueDate: date, status: TaskStatus.IN_PROGRESS } }),
      this.taskRepo.count({ where: { dueDate: date, status: TaskStatus.COMPLETED } }),
      this.taskRepo.count({
        where: { dueDate: LessThan(date), status: Not(In(CLOSED_TASK_STATUSES)) },
      }),
      this.attendanceRepo.count({ where: { workDate: date } }),
      this.wateringRepo.find({ where: { workDate: date } }),
    ]);

    const plannedLiters = wateringRows.reduce((s, w) => s + (w.plannedLiters ?? 0), 0);
    const actualLiters = wateringRows.reduce((s, w) => s + (w.actualLiters ?? 0), 0);
    const wateringDone = wateringRows.filter(
      (w) => w.status === WateringStatus.DONE,
    ).length;
    const wateringNeedsReview = wateringRows.filter(
      (w) => w.status === WateringStatus.NEEDS_REVIEW,
    ).length;

    return {
      date,
      tasksToday,
      closed,
      inProgress,
      needsReview,
      overdue,
      attendanceCount,
      watering: {
        total: wateringRows.length,
        done: wateringDone,
        needsReview: wateringNeedsReview,
        plannedLiters,
        actualLiters,
        litersDiff: actualLiters - plannedLiters,
      },
    };
  }

  async create(dto: CreateAdminReportDto, user: User) {
    const row = this.reportRepo.create({
      reportDate: dto.reportDate,
      authorId: user.id,
      completedWorks: dto.completedWorks?.trim() || null,
      pendingWorks: dto.pendingWorks?.trim() || null,
      tasksInProgress: dto.tasksInProgress?.trim() || null,
      overdueTasks: dto.overdueTasks?.trim() || null,
      wateringDone: dto.wateringDone?.trim() || null,
      plannedLiters: dto.plannedLiters ?? null,
      actualLiters: dto.actualLiters ?? null,
      issues: dto.issues?.trim() || null,
      attentionObjects: dto.attentionObjects?.trim() || null,
      brigadesInfo: dto.brigadesInfo?.trim() || null,
      waterCarriersInfo: dto.waterCarriersInfo?.trim() || null,
      decisions: dto.decisions?.trim() || null,
      comment: dto.comment?.trim() || null,
      photoUrls: serializePhotoUrls(dto.photoUrls ?? []),
      status: AdminReportStatus.DRAFT,
      statusHistory: '[]',
    });
    this.pushHistory(row, AdminReportStatus.DRAFT, user, 'Черновик создан');
    const saved = await this.reportRepo.save(row);
    return this.findOne(saved.id);
  }

  private assertEditable(row: AdminDailyReport) {
    if (
      row.status !== AdminReportStatus.DRAFT &&
      row.status !== AdminReportStatus.RETURNED
    ) {
      throw new BadRequestException(
        'Редактировать можно только черновик или возвращённый отчёт',
      );
    }
  }

  async update(id: number, dto: UpdateAdminReportDto) {
    const row = await this.reportRepo.findOne({ where: { id } });
    if (!row) throw new NotFoundException('Отчёт не найден');
    this.assertEditable(row);

    const textFields: (keyof UpdateAdminReportDto & keyof AdminDailyReport)[] = [
      'completedWorks',
      'pendingWorks',
      'tasksInProgress',
      'overdueTasks',
      'wateringDone',
      'issues',
      'attentionObjects',
      'brigadesInfo',
      'waterCarriersInfo',
      'decisions',
      'comment',
    ];
    for (const field of textFields) {
      const value = dto[field];
      if (value !== undefined) {
        (row[field] as string | null) =
          typeof value === 'string' ? value.trim() || null : null;
      }
    }
    if (dto.reportDate !== undefined) row.reportDate = dto.reportDate;
    if (dto.plannedLiters !== undefined) row.plannedLiters = dto.plannedLiters;
    if (dto.actualLiters !== undefined) row.actualLiters = dto.actualLiters;
    if (dto.photoUrls !== undefined)
      row.photoUrls = serializePhotoUrls(dto.photoUrls);

    await this.reportRepo.save(row);
    return this.findOne(id);
  }

  async submit(id: number, user: User) {
    const row = await this.reportRepo.findOne({ where: { id } });
    if (!row) throw new NotFoundException('Отчёт не найден');
    if (
      row.status !== AdminReportStatus.DRAFT &&
      row.status !== AdminReportStatus.FORMED &&
      row.status !== AdminReportStatus.RETURNED
    ) {
      throw new BadRequestException('Отчёт уже отправлен на проверку или подтверждён');
    }
    row.status = AdminReportStatus.IN_REVIEW;
    this.pushHistory(row, AdminReportStatus.IN_REVIEW, user, 'Отправлен на проверку');
    await this.reportRepo.save(row);
    return this.findOne(id);
  }

  async review(id: number, reviewer: User, dto: ReviewAdminReportDto) {
    const row = await this.reportRepo.findOne({ where: { id } });
    if (!row) throw new NotFoundException('Отчёт не найден');
    if (row.status !== AdminReportStatus.IN_REVIEW) {
      throw new BadRequestException(
        'Проверить можно только отчёт со статусом «На проверке»',
      );
    }
    row.status = dto.status;
    row.reviewedById = reviewer.id;
    row.reviewedAt = new Date();
    row.reviewComment = dto.reviewComment?.trim() || null;
    this.pushHistory(row, dto.status, reviewer, dto.reviewComment ?? null);
    await this.reportRepo.save(row);
    return this.findOne(id);
  }

  async remove(id: number, user: User) {
    const row = await this.reportRepo.findOne({ where: { id } });
    if (!row) throw new NotFoundException('Отчёт не найден');
    // После подтверждения удалить может только Директор («специальное право»).
    if (
      row.status === AdminReportStatus.APPROVED &&
      user.role !== UserRole.DIRECTOR
    ) {
      throw new ForbiddenException(
        'Подтверждённый отчёт может удалить только Директор',
      );
    }
    await this.reportRepo.remove(row);
  }
}
