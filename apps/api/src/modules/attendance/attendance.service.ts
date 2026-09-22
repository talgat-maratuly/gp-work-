import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { format, parseISO, startOfDay } from 'date-fns';
import { EntityManager, In, Repository } from 'typeorm';
import { businessDateString } from '../../common/business-date';
import { AttendanceStatus } from '../../common/enums/attendance-status.enum';
import { UserRole } from '../../common/enums/user-role.enum';
import { AttendanceRecord } from '../../entities/attendance-record.entity';
import { User } from '../../entities/user.entity';
import { WorkLog } from '../../entities/work-log.entity';
import { WorkDaySession, WorkDayStatus } from '../../entities/work-day-session.entity';
import { UsersService } from '../users/users.service';
import { AttendanceQueryDto } from './dto/attendance-query.dto';
import { ClockAttendanceDto } from './dto/clock-attendance.dto';

function normalizeName(name: string): string {
  return name.trim().replace(/\s+/g, ' ');
}

function calcWorkedHours(checkIn: Date, checkOut: Date): number {
  const hours = (checkOut.getTime() - checkIn.getTime()) / 3_600_000;
  return Math.max(0, Math.round(hours * 100) / 100);
}

@Injectable()
export class AttendanceService {
  constructor(
    @InjectRepository(AttendanceRecord)
    private readonly attendanceRepo: Repository<AttendanceRecord>,
    private readonly usersService: UsersService,
  ) {}

  private mapRecord(row: AttendanceRecord) {
    const workedHours =
      row.workedHours != null ? Number(row.workedHours) : null;
    return {
      id: row.id,
      workDate: row.workDate,
      workerFullName: row.workerFullName,
      userId: row.userId,
      clockManaged: row.clockManaged ?? false,
      checkInTime: row.checkInTime,
      checkOutTime: row.checkOutTime,
      lastActivityTime: row.lastActivityTime,
      checkInLatitude: row.checkInLatitude,
      checkInLongitude: row.checkInLongitude,
      checkInAccuracy: row.checkInAccuracy ?? null,
      checkOutLatitude: row.checkOutLatitude,
      checkOutLongitude: row.checkOutLongitude,
      checkOutAccuracy: row.checkOutAccuracy ?? null,
      workedHours,
      status: row.status,
      reportCount: row.reportCount,
      firstWorkLogId: row.firstWorkLogId,
      completionPercent: row.completionPercent ?? null,
      extraValues: this.parseExtra(row.extraValues),
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }

  // Serialize the clock and existing field/report integrations for this employee.
  async lockEmployee(manager: EntityManager, userId: number) {
    await manager.getRepository(User).createQueryBuilder('employee')
      .select('employee.id').where('employee.id = :userId', { userId })
      .setLock('pessimistic_write').getOneOrFail();
  }

  private activeDay(repo: Repository<AttendanceRecord>, userId: number, today = businessDateString()) {
    return repo.createQueryBuilder('attendance')
      .where('attendance.userId = :userId AND attendance.status = :status', { userId, status: AttendanceStatus.ON_DUTY })
      // Historical report-only rows do not prove a still-running shift.
      .andWhere(`(attendance.clock_managed = true OR attendance.work_date = :today OR EXISTS (
        SELECT 1 FROM work_day_sessions field_day
        WHERE field_day.user_id = attendance.user_id AND field_day.shift_date = attendance.work_date
          AND field_day.status IN ('OPEN', 'RETURNED')
      ))`, { today })
      .orderBy('attendance.checkInTime', 'ASC').getOne();
  }

  async getMyDay(user: User) {
    const today = businessDateString();
    const [open, todayRecord, recent, fieldSession] = await Promise.all([
      this.activeDay(this.attendanceRepo, user.id, today),
      this.attendanceRepo.findOne({ where: { userId: user.id, workDate: today } }),
      this.attendanceRepo.find({ where: { userId: user.id }, order: { workDate: 'DESC', checkInTime: 'DESC' }, take: 31 }),
      this.attendanceRepo.manager.getRepository(WorkDaySession).findOne({
        where: { userId: user.id, status: In([WorkDayStatus.OPEN, WorkDayStatus.RETURNED]) },
        order: { startedAt: 'DESC' }, relations: { section: true },
      }),
    ]);
    const current = open ?? todayRecord;
    const needsFieldClose = fieldSession && (fieldSession.status === WorkDayStatus.OPEN || fieldSession.shiftDate === current?.workDate);
    return {
      today, serverTime: new Date().toISOString(),
      current: current ? this.mapRecord(current) : null,
      recent: recent.map(row => this.mapRecord(row)),
      fieldSession: needsFieldClose ? { sectionCode: fieldSession.section.code, status: fieldSession.status } : null,
    };
  }

  async startMine(dto: ClockAttendanceDto, user: User) {
    return this.attendanceRepo.manager.transaction(async manager => {
      await this.lockEmployee(manager, user.id);
      const repo = manager.getRepository(AttendanceRecord);
      const open = await this.activeDay(repo, user.id);
      if (open) {
        if (!open.clockManaged) {
          open.clockManaged = true;
          await repo.save(open);
        }
        return this.mapRecord(open);
      }
      const now = new Date();
      const workDate = businessDateString(now);
      const existing = await repo.findOne({ where: { userId: user.id, workDate } });
      // A repeated or delayed request cannot reopen a completed day.
      if (existing) return this.mapRecord(existing);
      return this.mapRecord(await repo.save(repo.create({
        userId: user.id, workerFullName: normalizeName(user.fullName), workDate, clockManaged: true,
        checkInTime: now, lastActivityTime: now, checkInLatitude: dto.latitude,
        checkInLongitude: dto.longitude, checkInAccuracy: dto.accuracy,
        checkOutTime: null, checkOutLatitude: null, checkOutLongitude: null, checkOutAccuracy: null,
        status: AttendanceStatus.ON_DUTY, workedHours: null, reportCount: 0,
        completionPercent: null, firstWorkLogId: null,
      })));
    });
  }

  async finishMine(id: number, dto: ClockAttendanceDto, user: User) {
    return this.attendanceRepo.manager.transaction(async manager => {
      await this.lockEmployee(manager, user.id);
      const repo = manager.getRepository(AttendanceRecord);
      const row = await repo.findOne({ where: { id, userId: user.id } });
      if (!row) throw new NotFoundException('Рабочий день не найден');
      if (row.status === AttendanceStatus.COMPLETED) return this.mapRecord(row);
      const field = await manager.getRepository(WorkDaySession).findOne({ where: [
        { userId: user.id, status: WorkDayStatus.OPEN },
        { userId: user.id, shiftDate: row.workDate, status: WorkDayStatus.RETURNED },
      ] });
      if (field) throw new BadRequestException('Завершите рабочий день в форме участка: QR, фото и результат работы. Табель обновится автоматически.');
      const now = new Date();
      if (!row.clockManaged && row.workDate !== businessDateString(now)) {
        throw new BadRequestException('Это старая запись по отчёту без отметки начала смены. Начните текущий рабочий день.');
      }
      Object.assign(row, {
        checkOutTime: now, lastActivityTime: now, checkOutLatitude: dto.latitude,
        checkOutLongitude: dto.longitude, checkOutAccuracy: dto.accuracy,
        workedHours: String(calcWorkedHours(row.checkInTime, now)), status: AttendanceStatus.COMPLETED,
        clockManaged: true,
      });
      return this.mapRecord(await repo.save(row));
    });
  }

  private parseExtra(raw: string | null): Record<string, unknown> | null {
    if (!raw) return null;
    try {
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === 'object' ? parsed : null;
    } catch {
      return null;
    }
  }

  async syncOnWorkLogCreated(workLog: WorkLog, manager?: EntityManager): Promise<ReturnType<AttendanceService['mapRecord']>> {
    if (!manager) return this.attendanceRepo.manager.transaction(tx => this.syncOnWorkLogCreated(workLog, tx));
    if (workLog.userId) await this.lockEmployee(manager, workLog.userId);
    const repo = manager.getRepository(AttendanceRecord);
    const workerFullName = normalizeName(workLog.workerFullName);
    const workDate = businessDateString(workLog.submittedAt);
    const submittedAt = workLog.submittedAt;

    let row = await repo.findOne({
      where: workLog.userId
        ? { workDate, userId: workLog.userId }
        : { workDate, workerFullName },
    });
    if (!row && workLog.userId) row = await this.activeDay(repo, workLog.userId, workDate);

    if (!row) {
      row = repo.create({
        workDate,
        workerFullName,
        userId: workLog.userId,
        checkInTime: submittedAt,
        lastActivityTime: submittedAt,
        checkInLatitude: workLog.latitude,
        checkInLongitude: workLog.longitude,
        status: AttendanceStatus.ON_DUTY,
        reportCount: 1,
        firstWorkLogId: workLog.id,
      });
      return this.mapRecord(await repo.save(row));
    }

    if (row.status === AttendanceStatus.COMPLETED) {
      return this.mapRecord(row);
    }

    row.reportCount += 1;
    row.lastActivityTime = submittedAt;
    if (!row.firstWorkLogId) row.firstWorkLogId = workLog.id;
    return this.mapRecord(await repo.save(row));
  }

  async syncOnWorkDayStarted(session: WorkDaySession, user: User, manager?: EntityManager): Promise<ReturnType<AttendanceService['mapRecord']>> {
    if (!manager) return this.attendanceRepo.manager.transaction(tx => this.syncOnWorkDayStarted(session, user, tx));
    await this.lockEmployee(manager, user.id);
    const repo = manager.getRepository(AttendanceRecord);
    let row = await repo.findOne({ where: { workDate: session.shiftDate, userId: user.id } });
    if (row) {
      if (row.status === AttendanceStatus.COMPLETED && session.status === WorkDayStatus.OPEN) {
        throw new BadRequestException('Рабочий день за эту дату уже завершён');
      }
      return this.mapRecord(row);
    }
    const previous = await this.activeDay(repo, user.id, session.shiftDate);
    if (previous) throw new BadRequestException('Сначала завершите предыдущий рабочий день в разделе «Мой рабочий день»');
    row = repo.create({
      workDate: session.shiftDate,
      userId: user.id,
      workerFullName: normalizeName(user.fullName),
      checkInTime: session.startedAt,
      lastActivityTime: session.startedAt,
      checkInLatitude: session.startLatitude,
      checkInLongitude: session.startLongitude,
      checkInAccuracy: session.startAccuracy,
      checkOutTime: null,
      checkOutLatitude: null,
      checkOutLongitude: null,
      workedHours: null,
      status: AttendanceStatus.ON_DUTY,
      reportCount: 0,
      firstWorkLogId: null,
    });
    return this.mapRecord(await repo.save(row));
  }

  async syncOnWorkDayClosed(session: WorkDaySession, user: User, manager?: EntityManager): Promise<ReturnType<AttendanceService['mapRecord']>> {
    if (!manager) return this.attendanceRepo.manager.transaction(tx => this.syncOnWorkDayClosed(session, user, tx));
    await this.lockEmployee(manager, user.id);
    const repo = manager.getRepository(AttendanceRecord);
    let row = await repo.findOne({ where: { workDate: session.shiftDate, userId: user.id } });
    if (!row) {
      await this.syncOnWorkDayStarted(session, user, manager);
      row = await repo.findOneOrFail({ where: { workDate: session.shiftDate, userId: user.id } });
    }
    row.completionPercent = session.overallPercent;
    // Correcting an already closed report does not prove additional time on duty.
    if (row.status === AttendanceStatus.COMPLETED && row.checkOutTime) {
      return this.mapRecord(await repo.save(row));
    }
    const checkOutTime = session.closedAt ?? new Date();
    row.checkOutTime = checkOutTime;
    row.lastActivityTime = checkOutTime;
    row.checkOutLatitude = session.endLatitude;
    row.checkOutLongitude = session.endLongitude;
    row.checkOutAccuracy = session.endAccuracy;
    row.workedHours = String(calcWorkedHours(row.checkInTime, checkOutTime));
    row.status = AttendanceStatus.COMPLETED;
    return this.mapRecord(await repo.save(row));
  }

  private async applyRoleFilter(
    qb: ReturnType<Repository<AttendanceRecord>['createQueryBuilder']>,
    user?: User,
  ) {
    if (
      !user ||
      user.role === UserRole.ADMIN ||
      user.role === UserRole.DIRECTOR ||
      user.role === UserRole.ACCOUNTANT ||
      user.role === UserRole.AGRONOMIST
    ) {
      return qb;
    }
    if (user.role === UserRole.BRIGADIER) {
      if (!user.brigadeId) {
        qb.andWhere('1 = 0');
        return qb;
      }
      const userIds = await this.usersService.getBrigadeWorkerIds(user.brigadeId);
      if (!userIds.length) {
        qb.andWhere('1 = 0');
        return qb;
      }
      qb.andWhere('attendance.userId IN (:...userIds)', { userIds });
    }
    return qb;
  }

  async findAll(query: AttendanceQueryDto, user?: User) {
    let qb = this.attendanceRepo
      .createQueryBuilder('attendance')
      .orderBy('attendance.workDate', 'DESC')
      .addOrderBy('attendance.checkInTime', 'DESC');

    if (query.dateFrom) {
      qb.andWhere('attendance.workDate >= :dateFrom', {
        dateFrom: format(startOfDay(parseISO(query.dateFrom)), 'yyyy-MM-dd'),
      });
    }
    if (query.dateTo) {
      qb.andWhere('attendance.workDate <= :dateTo', {
        dateTo: format(startOfDay(parseISO(query.dateTo)), 'yyyy-MM-dd'),
      });
    }
    if (query.workerFullName?.trim()) {
      qb.andWhere('attendance.workerFullName ILIKE :worker', {
        worker: `%${query.workerFullName.trim()}%`,
      });
    }

    qb = await this.applyRoleFilter(qb, user);
    const rows = await qb.getMany();
    return rows.map((r) => {
      const record = this.mapRecord(r);
      // Accounting needs time and completion data, not precise location or custom personal fields.
      return user?.role === UserRole.ACCOUNTANT ? {
        ...record, checkInLatitude: null, checkInLongitude: null,
        checkOutLatitude: null, checkOutLongitude: null, checkInAccuracy: null, checkOutAccuracy: null, extraValues: null,
      } : record;
    });
  }
}
