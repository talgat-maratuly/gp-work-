import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { format, parseISO, startOfDay } from 'date-fns';
import { EntityManager, Repository } from 'typeorm';
import { businessDateString } from '../../common/business-date';
import { AttendanceStatus } from '../../common/enums/attendance-status.enum';
import { UserRole } from '../../common/enums/user-role.enum';
import { AttendanceRecord } from '../../entities/attendance-record.entity';
import { User } from '../../entities/user.entity';
import { WorkLog } from '../../entities/work-log.entity';
import { WorkDaySession } from '../../entities/work-day-session.entity';
import { UsersService } from '../users/users.service';
import { AttendanceQueryDto } from './dto/attendance-query.dto';

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
      checkInTime: row.checkInTime,
      checkOutTime: row.checkOutTime,
      lastActivityTime: row.lastActivityTime,
      checkInLatitude: row.checkInLatitude,
      checkInLongitude: row.checkInLongitude,
      checkOutLatitude: row.checkOutLatitude,
      checkOutLongitude: row.checkOutLongitude,
      workedHours,
      status: row.status,
      reportCount: row.reportCount,
      firstWorkLogId: row.firstWorkLogId,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }

  async syncOnWorkLogCreated(workLog: WorkLog) {
    const workerFullName = normalizeName(workLog.workerFullName);
    const workDate = businessDateString(workLog.submittedAt);
    const submittedAt = workLog.submittedAt;

    let row = await this.attendanceRepo.findOne({
      where: workLog.userId
        ? { workDate, userId: workLog.userId }
        : { workDate, workerFullName },
    });

    if (!row) {
      row = this.attendanceRepo.create({
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
      return this.mapRecord(await this.attendanceRepo.save(row));
    }

    if (row.status === AttendanceStatus.COMPLETED) {
      return this.mapRecord(row);
    }

    row.reportCount += 1;
    row.lastActivityTime = submittedAt;
    if (!row.firstWorkLogId) row.firstWorkLogId = workLog.id;
    return this.mapRecord(await this.attendanceRepo.save(row));
  }

  async syncOnWorkDayStarted(session: WorkDaySession, user: User, manager?: EntityManager) {
    const repo = manager?.getRepository(AttendanceRecord) ?? this.attendanceRepo;
    let row = await repo.findOne({ where: { workDate: session.shiftDate, userId: user.id } });
    if (row) return this.mapRecord(row);
    row = repo.create({
      workDate: session.shiftDate,
      userId: user.id,
      workerFullName: normalizeName(user.fullName),
      checkInTime: session.startedAt,
      lastActivityTime: session.startedAt,
      checkInLatitude: session.startLatitude,
      checkInLongitude: session.startLongitude,
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

  async syncOnWorkDayClosed(session: WorkDaySession, user: User, manager?: EntityManager) {
    const repo = manager?.getRepository(AttendanceRecord) ?? this.attendanceRepo;
    let row = await repo.findOne({ where: { workDate: session.shiftDate, userId: user.id } });
    if (!row) {
      await this.syncOnWorkDayStarted(session, user, manager);
      row = await repo.findOneOrFail({ where: { workDate: session.shiftDate, userId: user.id } });
    }
    if (row.status === AttendanceStatus.COMPLETED && row.checkOutTime) return this.mapRecord(row);
    const checkOutTime = session.closedAt ?? new Date();
    row.checkOutTime = checkOutTime;
    row.lastActivityTime = checkOutTime;
    row.checkOutLatitude = session.endLatitude;
    row.checkOutLongitude = session.endLongitude;
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
    return rows.map((r) => this.mapRecord(r));
  }
}
