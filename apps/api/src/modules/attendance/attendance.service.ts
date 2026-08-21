import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { endOfDay, format, parseISO, startOfDay } from 'date-fns';
import { Repository } from 'typeorm';
import { AttendanceStatus } from '../../common/enums/attendance-status.enum';
import { UserRole } from '../../common/enums/user-role.enum';
import { AttendanceRecord } from '../../entities/attendance-record.entity';
import { User } from '../../entities/user.entity';
import { WorkLog } from '../../entities/work-log.entity';
import { UsersService } from '../users/users.service';
import { AttendanceQueryDto } from './dto/attendance-query.dto';
import { CheckOutDto } from './dto/check-out.dto';

function normalizeName(name: string): string {
  return name.trim().replace(/\s+/g, ' ');
}

function todayDateString(): string {
  return format(startOfDay(new Date()), 'yyyy-MM-dd');
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
    @InjectRepository(WorkLog)
    private readonly workLogRepo: Repository<WorkLog>,
    private readonly usersService: UsersService,
  ) {}

  private mapRecord(row: AttendanceRecord) {
    const workedHours =
      row.workedHours != null ? Number(row.workedHours) : null;
    return {
      id: row.id,
      workDate: row.workDate,
      workerFullName: row.workerFullName,
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
    const workDate = format(startOfDay(workLog.submittedAt), 'yyyy-MM-dd');
    const submittedAt = workLog.submittedAt;

    let row = await this.attendanceRepo.findOne({
      where: { workDate, workerFullName },
    });

    if (!row) {
      row = this.attendanceRepo.create({
        workDate,
        workerFullName,
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
    return this.mapRecord(await this.attendanceRepo.save(row));
  }

  async findActiveForToday() {
    const workDate = todayDateString();
    const rows = await this.attendanceRepo.find({
      where: { workDate, status: AttendanceStatus.ON_DUTY },
      order: { workerFullName: 'ASC' },
    });
    return rows
      .filter((r) => r.checkOutTime == null)
      .map((r) => ({
        id: r.id,
        workerFullName: r.workerFullName,
        checkInTime: r.checkInTime,
      }));
  }

  private async findTodayAttendanceByName(workerFullName: string) {
    const normalized = normalizeName(workerFullName);
    const workDate = todayDateString();
    return this.attendanceRepo.findOne({
      where: { workDate, workerFullName: normalized },
    });
  }

  private async ensureAttendanceFromWorkLogs(workerFullName: string) {
    const normalized = normalizeName(workerFullName);
    const todayStart = startOfDay(new Date());
    const todayEnd = endOfDay(new Date());

    const logs = await this.workLogRepo
      .createQueryBuilder('workLog')
      .where('workLog.workerFullName ILIKE :name', { name: normalized })
      .andWhere('workLog.submittedAt >= :todayStart', { todayStart })
      .andWhere('workLog.submittedAt <= :todayEnd', { todayEnd })
      .orderBy('workLog.submittedAt', 'ASC')
      .getMany();

    if (!logs.length) return null;

    const first = logs[0];
    const last = logs[logs.length - 1];
    const workDate = todayDateString();

    const row = this.attendanceRepo.create({
      workDate,
      workerFullName: normalized,
      checkInTime: first.submittedAt,
      lastActivityTime: last.submittedAt,
      checkInLatitude: first.latitude,
      checkInLongitude: first.longitude,
      status: AttendanceStatus.ON_DUTY,
      reportCount: logs.length,
      firstWorkLogId: first.id,
    });

    return this.attendanceRepo.save(row);
  }

  async checkOut(dto: CheckOutDto) {
    let row: AttendanceRecord | null = null;

    if (dto.attendanceId) {
      row = await this.attendanceRepo.findOne({ where: { id: dto.attendanceId } });
      if (!row) throw new NotFoundException('Запись табеля не найдена');
    } else if (dto.workerFullName?.trim()) {
      row = await this.findTodayAttendanceByName(dto.workerFullName);
      if (!row) {
        row = await this.ensureAttendanceFromWorkLogs(dto.workerFullName);
      }
      if (!row) {
        throw new NotFoundException(
          'Сотрудник не найден в табеле за сегодня. Сначала отправьте отчёт с участка.',
        );
      }
    } else {
      throw new BadRequestException('Укажите сотрудника для отметки ухода');
    }

    if (row.workDate !== todayDateString()) {
      throw new BadRequestException('Отметка ухода доступна только за сегодня');
    }

    if (row.status === AttendanceStatus.COMPLETED || row.checkOutTime) {
      throw new ConflictException('Уход уже отмечен');
    }

    const checkOutTime = new Date();
    const hasCoords = dto.latitude != null && dto.longitude != null;

    row.checkOutTime = checkOutTime;
    row.checkOutLatitude = dto.latitude ?? null;
    row.checkOutLongitude = dto.longitude ?? null;
    row.workedHours = String(calcWorkedHours(row.checkInTime, checkOutTime));
    row.status = AttendanceStatus.COMPLETED;

    if (!hasCoords && dto.locationAllowed === false) {
      // still allow checkout without geo
    }

    const saved = await this.attendanceRepo.save(row);
    return this.mapRecord(saved);
  }

  private async applyRoleFilter(
    qb: ReturnType<Repository<AttendanceRecord>['createQueryBuilder']>,
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
      qb.andWhere('attendance.workerFullName IN (:...names)', { names });
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
