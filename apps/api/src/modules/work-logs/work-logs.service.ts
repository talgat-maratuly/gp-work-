import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { endOfDay, isValid, parseISO, startOfDay, startOfMonth, subDays } from 'date-fns';
import { Repository } from 'typeorm';
import { mapWorkLogsWithPhotos, withPhotoUrlsArray } from '../../common/work-log-response';
import { ReviewStatus } from '../../common/enums/review-status.enum';
import { TaskStatus } from '../../common/enums/task-status.enum';
import { UserRole } from '../../common/enums/user-role.enum';
import { Section } from '../../entities/section.entity';
import { Task } from '../../entities/task.entity';
import { User } from '../../entities/user.entity';
import { WorkLog } from '../../entities/work-log.entity';
import { UsersService } from '../users/users.service';
import { ReviewWorkLogDto } from './dto/review-work-log.dto';
import { WorkLogQueryDto } from './dto/work-log-query.dto';

@Injectable()
export class WorkLogsService {
  constructor(
    @InjectRepository(WorkLog)
    private readonly workLogRepo: Repository<WorkLog>,
    @InjectRepository(Section)
    private readonly sectionRepo: Repository<Section>,
    @InjectRepository(Task)
    private readonly taskRepo: Repository<Task>,
    private readonly usersService: UsersService,
  ) {}

  private parseQueryDateOrThrow(value: string, field: 'dateFrom' | 'dateTo'): Date {
    const parsed = parseISO(value);
    if (!isValid(parsed)) {
      throw new BadRequestException(`Некорректная дата в параметре "${field}"`);
    }
    return parsed;
  }

  private applyFilters(qb: ReturnType<Repository<WorkLog>['createQueryBuilder']>, query: WorkLogQueryDto) {
    // Frontend may send `all` when user didn't choose dates.
    const dateFromNormalized = query.dateFrom?.trim().toLowerCase();
    const dateToNormalized = query.dateTo?.trim().toLowerCase();

    if (dateFromNormalized && dateFromNormalized !== 'all') {
      const parsedDateFrom = this.parseQueryDateOrThrow(dateFromNormalized, 'dateFrom');
      qb.andWhere('workLog.submittedAt >= :dateFrom', {
        dateFrom: startOfDay(parsedDateFrom),
      });
    }
    if (dateToNormalized && dateToNormalized !== 'all') {
      const parsedDateTo = this.parseQueryDateOrThrow(dateToNormalized, 'dateTo');
      qb.andWhere('workLog.submittedAt <= :dateTo', {
        dateTo: endOfDay(parsedDateTo),
      });
    }
    if (query.workerFullName?.trim()) {
      qb.andWhere('workLog.workerFullName ILIKE :worker', {
        worker: `%${query.workerFullName.trim()}%`,
      });
    }
    if (query.sectionId) {
      qb.andWhere('workLog.sectionId = :sectionId', { sectionId: query.sectionId });
    }
    if (query.workTypeId) {
      qb.andWhere('workLog.workTypeId = :workTypeId', { workTypeId: query.workTypeId });
    }
    if (query.objectId) {
      qb.andWhere('section.objectId = :objectId', { objectId: query.objectId });
    }
    return qb;
  }

  private baseQuery() {
    return this.workLogRepo
      .createQueryBuilder('workLog')
      .leftJoinAndSelect('workLog.section', 'section')
      .leftJoinAndSelect('section.object', 'object')
      .leftJoinAndSelect('workLog.workType', 'workType')
      .leftJoinAndSelect('workLog.task', 'task')
      .leftJoinAndSelect('workLog.reviewedBy', 'reviewedBy');
  }

  private async applyRoleFilter(
    qb: ReturnType<Repository<WorkLog>['createQueryBuilder']>,
    user?: User,
  ) {
    if (!user || user.role === UserRole.ADMIN || user.role === UserRole.AGRONOMIST) {
      return qb;
    }
    if (user.role === UserRole.BRIGADIER && user.brigadeId) {
      const names = await this.usersService.getBrigadeWorkerNames(user.brigadeId);
      if (!names.length) {
        qb.andWhere('1 = 0');
        return qb;
      }
      qb.andWhere('workLog.workerFullName IN (:...names)', { names });
    }
    return qb;
  }

  async findAll(query: WorkLogQueryDto, user?: User) {
    let qb = this.applyFilters(this.baseQuery(), query);
    qb = await this.applyRoleFilter(qb, user);
    qb.orderBy('workLog.submittedAt', 'DESC');
    const rows = await qb.getMany();
    return mapWorkLogsWithPhotos(rows);
  }

  async findOne(id: number) {
    const row = await this.baseQuery().where('workLog.id = :id', { id }).getOne();
    if (!row) throw new NotFoundException('Запись не найдена');
    return withPhotoUrlsArray(row);
  }

  async review(id: number, dto: ReviewWorkLogDto, reviewer: User) {
    if (reviewer.role !== UserRole.ADMIN && reviewer.role !== UserRole.BRIGADIER && reviewer.role !== UserRole.AGRONOMIST) {
      throw new ForbiddenException('Недостаточно прав для проверки отчёта');
    }

    const row = await this.workLogRepo.findOne({ where: { id } });
    if (!row) throw new NotFoundException('Запись не найдена');

    row.reviewStatus = dto.reviewStatus;
    row.reviewComment = dto.reviewComment?.trim() || null;
    row.reviewedById = reviewer.id;
    row.reviewedAt = new Date();
    await this.workLogRepo.save(row);

    if (row.taskId) {
      const task = await this.taskRepo.findOne({ where: { id: row.taskId } });
      if (task) {
        task.status =
          dto.reviewStatus === ReviewStatus.APPROVED ? TaskStatus.VERIFIED : TaskStatus.REJECTED;
        await this.taskRepo.save(task);
      }
    }

    return this.findOne(id);
  }

  async remove(id: number) {
    const row = await this.findOne(id);
    await this.workLogRepo.delete(id);
    return row;
  }

  async getStats() {
    const now = new Date();
    const todayStart = startOfDay(now);
    const weekStart = subDays(now, 7);
    const monthStart = startOfMonth(now);

    const [todayCount, week, month, recent, allLogs, sections] = await Promise.all([
      this.workLogRepo
        .createQueryBuilder('workLog')
        .where('workLog.submittedAt >= :todayStart', { todayStart })
        .getCount(),
      this.workLogRepo
        .createQueryBuilder('workLog')
        .where('workLog.submittedAt >= :weekStart', { weekStart })
        .getCount(),
      this.workLogRepo
        .createQueryBuilder('workLog')
        .where('workLog.submittedAt >= :monthStart', { monthStart })
        .getCount(),
      this.baseQuery().orderBy('workLog.submittedAt', 'DESC').take(8).getMany(),
      this.workLogRepo.find({
        select: { workerFullName: true, sectionId: true, submittedAt: true },
      }),
      this.sectionRepo.find({ relations: { object: true } }),
    ]);

    const workerCounts = new Map<string, number>();
    for (const row of allLogs) {
      workerCounts.set(row.workerFullName, (workerCounts.get(row.workerFullName) ?? 0) + 1);
    }
    const topWorkers = [...workerCounts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([name, count]) => ({ name, count }));

    const sectionLast = new Map<number, string>();
    for (const row of allLogs) {
      const prev = sectionLast.get(row.sectionId);
      if (!prev || row.submittedAt.toISOString() > prev) {
        sectionLast.set(row.sectionId, row.submittedAt.toISOString());
      }
    }

    const staleSections = sections
      .map((s) => ({
        id: s.id,
        name: s.name,
        code: s.code,
        objectName: s.object.name,
        lastWork: sectionLast.get(s.id) ?? null,
      }))
      .sort((a, b) => {
        if (!a.lastWork && !b.lastWork) return 0;
        if (!a.lastWork) return -1;
        if (!b.lastWork) return 1;
        return new Date(a.lastWork).getTime() - new Date(b.lastWork).getTime();
      })
      .slice(0, 8);

    return {
      today: todayCount,
      week,
      month,
      recent: mapWorkLogsWithPhotos(recent),
      topWorkers,
      staleSections,
    };
  }
}
