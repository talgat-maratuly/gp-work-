import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { businessDateString } from '../../common/business-date';
import { ExecutionStatus, RouteStatus } from '../../common/enums/field-execution.enums';
import { VehicleAssignmentStatus, VehicleType } from '../../common/enums/resource.enums';
import {
  AttendanceRecord,
  ChecklistAnswer,
  FaceVerification,
  LocationEvent,
  Route,
  Section,
  StockMovement,
  Vehicle,
  WorkExecution,
  WorkExecutionEvent,
  WorkPhoto,
} from '../../entities';
import { durationMinutes, evidenceRange, isCompletedOnTime, percent, periodDates, ReportPeriod } from './operations.metrics';

type GroupBy = 'employee' | 'brigade' | 'object';

function assertDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new BadRequestException('Дата должна быть в формате YYYY-MM-DD');
}

@Injectable()
export class OperationsService {
  constructor(
    @InjectRepository(WorkExecution) private readonly executionRepo: Repository<WorkExecution>,
    @InjectRepository(WorkExecutionEvent) private readonly eventRepo: Repository<WorkExecutionEvent>,
    @InjectRepository(WorkPhoto) private readonly photoRepo: Repository<WorkPhoto>,
    @InjectRepository(ChecklistAnswer) private readonly checklistRepo: Repository<ChecklistAnswer>,
    @InjectRepository(FaceVerification) private readonly faceRepo: Repository<FaceVerification>,
    @InjectRepository(StockMovement) private readonly movementRepo: Repository<StockMovement>,
    @InjectRepository(Route) private readonly routeRepo: Repository<Route>,
    @InjectRepository(LocationEvent) private readonly locationRepo: Repository<LocationEvent>,
    @InjectRepository(Section) private readonly sectionRepo: Repository<Section>,
    @InjectRepository(Vehicle) private readonly vehicleRepo: Repository<Vehicle>,
    @InjectRepository(AttendanceRecord) private readonly attendanceRepo: Repository<AttendanceRecord>,
  ) {}

  private resolveDates(anchor?: string, period: ReportPeriod = 'day', dateFrom?: string, dateTo?: string) {
    if (dateFrom || dateTo) {
      const from = dateFrom || dateTo!;
      const to = dateTo || dateFrom!;
      assertDate(from); assertDate(to);
      if (from > to) throw new BadRequestException('Начальная дата позже конечной');
      return { dateFrom: from, dateTo: to };
    }
    const date = anchor || businessDateString();
    assertDate(date);
    try { return periodDates(date, period); } catch { throw new BadRequestException('Некорректная дата'); }
  }

  private executionQuery(dateFrom: string, dateTo: string) {
    const range = evidenceRange(dateFrom, dateTo, process.env.BUSINESS_UTC_OFFSET || '+05:00');
    return this.executionRepo
      .createQueryBuilder('execution')
      .leftJoinAndSelect('execution.task', 'task')
      .leftJoinAndSelect('task.workType', 'workType')
      .leftJoinAndSelect('execution.section', 'section')
      .leftJoinAndSelect('section.object', 'object')
      .leftJoinAndSelect('execution.worker', 'worker')
      .leftJoinAndSelect('execution.brigade', 'brigade')
      .leftJoinAndSelect('execution.routeStop', 'routeStop')
      .leftJoinAndSelect('execution.acceptedBy', 'acceptedBy')
      .where('execution.createdAt >= :from AND execution.createdAt < :to', range)
      .orderBy('execution.createdAt', 'DESC');
  }

  private async evidence(dateFrom: string, dateTo: string) {
    const executions = await this.executionQuery(dateFrom, dateTo).getMany();
    const ids = executions.map((row) => row.id);
    if (!ids.length) return executions.map((execution) => ({ execution, events: [], photos: [], checklist: [], faces: [], materials: [] }));
    const [events, photos, checklist, faces, materials] = await Promise.all([
      this.eventRepo.find({ where: { executionId: In(ids) }, relations: { actor: true }, order: { occurredAt: 'ASC' } }),
      this.photoRepo.find({ where: { executionId: In(ids) }, order: { capturedAt: 'ASC' } }),
      this.checklistRepo.find({ where: { executionId: In(ids) }, relations: { item: true } }),
      this.faceRepo.find({ where: { executionId: In(ids) }, relations: { reviewedBy: true } }),
      this.movementRepo.find({ where: { executionId: In(ids) }, relations: { product: true } }),
    ]);
    const byExecution = <T extends { executionId: number | null }>(rows: T[], id: number): T[] =>
      rows.filter((row) => row.executionId === id);
    return executions.map((execution) => ({
      execution,
      events: byExecution(events, execution.id),
      photos: byExecution(photos, execution.id),
      checklist: byExecution(checklist, execution.id),
      faces: byExecution(faces, execution.id),
      materials: byExecution(materials, execution.id),
    }));
  }

  async kpi(input: { anchor?: string; period?: ReportPeriod; dateFrom?: string; dateTo?: string; groupBy?: GroupBy }) {
    const dates = this.resolveDates(input.anchor, input.period, input.dateFrom, input.dateTo);
    const evidence = await this.evidence(dates.dateFrom, dates.dateTo);
    const groupBy = input.groupBy ?? 'brigade';
    type Row = { key: string; name: string; total: number; accepted: number; rejected: number; onTime: number; overdue: number; lateArrivals: number; durationTotal: number; durationCount: number; reworks: number; materials: number; objects: Set<number>; routeCompliant: number; routeMeasured: number };
    const groups = new Map<string, Row>();

    for (const item of evidence) {
      const { execution } = item;
      const object = execution.section.object;
      const identity = groupBy === 'employee'
        ? { key: String(execution.workerUserId), name: execution.worker.fullName }
        : groupBy === 'object'
          ? { key: String(object?.id ?? 0), name: object?.name ?? 'Без объекта' }
          : { key: String(execution.brigadeId ?? 0), name: execution.brigade?.name ?? 'Без бригады' };
      const row = groups.get(identity.key) ?? { ...identity, total: 0, accepted: 0, rejected: 0, onTime: 0, overdue: 0, lateArrivals: 0, durationTotal: 0, durationCount: 0, reworks: 0, materials: 0, objects: new Set<number>(), routeCompliant: 0, routeMeasured: 0 };
      row.total += 1;
      if (execution.status === ExecutionStatus.ACCEPTED) row.accepted += 1;
      if (execution.status === ExecutionStatus.REJECTED || item.events.some((event) => event.type === 'REJECTED')) row.rejected += 1;
      row.reworks += item.events.filter((event) => event.type === 'REJECTED').length;
      const onTime = isCompletedOnTime(execution.completedAt, execution.task.dueDate, process.env.BUSINESS_UTC_OFFSET || '+05:00');
      if (onTime === true) row.onTime += 1;
      if (onTime === false) row.overdue += 1;
      if (execution.routeStop?.plannedArrivalAt && execution.arrivedAt && execution.arrivedAt.getTime() - execution.routeStop.plannedArrivalAt.getTime() > 15 * 60_000) row.lateArrivals += 1;
      const duration = durationMinutes(execution.startedAt, execution.completedAt);
      if (duration != null) { row.durationTotal += duration; row.durationCount += 1; }
      row.materials += item.materials.reduce((sum, movement) => sum + Number(movement.quantity), 0);
      if (object?.id) row.objects.add(object.id);
      if (execution.arrivalDistanceMeters != null) {
        row.routeMeasured += 1;
        const allowed = execution.section.radiusMeters ?? 150;
        if (execution.arrivalDistanceMeters <= allowed + (execution.arrivalAccuracy ?? 0)) row.routeCompliant += 1;
      }
      groups.set(identity.key, row);
    }
    return {
      filters: { ...dates, groupBy },
      disclaimer: 'KPI основан на доказательных данных и не применяется автоматически к зарплате, увольнению или санкциям.',
      rows: [...groups.values()].map((row) => ({
        key: row.key,
        name: row.name,
        executions: row.total,
        accepted: row.accepted,
        acceptedPercent: percent(row.accepted, row.total),
        completedOnTime: row.onTime,
        overdue: row.overdue,
        lateArrivals: row.lateArrivals,
        averageDurationMinutes: row.durationCount ? Math.round(row.durationTotal / row.durationCount) : null,
        reworks: row.reworks,
        rejected: row.rejected,
        materialQuantity: Math.round(row.materials * 1000) / 1000,
        objectCount: row.objects.size,
        routeCompliancePercent: percent(row.routeCompliant, row.routeMeasured),
      })).sort((a, b) => b.executions - a.executions),
    };
  }

  async report(input: { anchor?: string; period?: ReportPeriod; dateFrom?: string; dateTo?: string }) {
    const dates = this.resolveDates(input.anchor, input.period, input.dateFrom, input.dateTo);
    const evidence = await this.evidence(dates.dateFrom, dates.dateTo);
    const rows = evidence.map((item) => {
      const latestFace = [...item.faces].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())[0];
      return {
        id: item.execution.id,
        status: item.execution.status,
        task: { id: item.execution.task.id, description: item.execution.task.description, dueDate: item.execution.task.dueDate, workType: item.execution.task.workType?.name ?? null },
        object: { id: item.execution.section.object?.id ?? null, name: item.execution.section.object?.name ?? null, section: item.execution.section.name },
        worker: { id: item.execution.worker.id, name: item.execution.worker.fullName },
        brigade: item.execution.brigade ? { id: item.execution.brigade.id, name: item.execution.brigade.name } : null,
        timeline: { arrivedAt: item.execution.arrivedAt, startedAt: item.execution.startedAt, completedAt: item.execution.completedAt, acceptedAt: item.execution.acceptedAt, durationMinutes: durationMinutes(item.execution.startedAt, item.execution.completedAt) },
        location: { latitude: item.execution.arrivalLatitude, longitude: item.execution.arrivalLongitude, accuracy: item.execution.arrivalAccuracy, distanceMeters: item.execution.arrivalDistanceMeters },
        face: latestFace ? { status: latestFace.status, selfieUrl: latestFace.selfieUrl, reviewedAt: latestFace.reviewedAt, reviewedBy: latestFace.reviewedBy?.fullName ?? null } : null,
        photos: item.photos.map((photo) => ({ phase: photo.phase, url: photo.url, capturedAt: photo.capturedAt, latitude: photo.latitude, longitude: photo.longitude })),
        checklist: item.checklist.map((answer) => ({ label: answer.item.label, required: answer.item.isRequired, completed: answer.isCompleted, completedAt: answer.completedAt })),
        materials: item.materials.map((movement) => ({ product: movement.product?.name ?? null, quantity: Number(movement.quantity), type: movement.type, movementId: movement.id })),
        audit: item.events.map((event) => ({ type: event.type, occurredAt: event.occurredAt, actor: event.actor?.fullName ?? null, latitude: event.latitude, longitude: event.longitude })),
      };
    });
    return {
      filters: dates,
      summary: {
        total: rows.length,
        accepted: rows.filter((row) => row.status === ExecutionStatus.ACCEPTED).length,
        awaitingReview: rows.filter((row) => row.status === ExecutionStatus.COMPLETED).length,
        rejected: rows.filter((row) => row.status === ExecutionStatus.REJECTED).length,
        withCompleteEvidence: rows.filter((row) => row.face && row.photos.some((photo) => photo.phase === 'BEFORE') && row.photos.some((photo) => photo.phase === 'AFTER') && row.checklist.filter((answer) => answer.required).every((answer) => answer.completed)).length,
      },
      rows,
    };
  }

  async dispatcher(date = businessDateString()) {
    assertDate(date);
    const routes = await this.routeRepo.find({
      where: { workDate: date },
      relations: { brigade: true, stops: { task: true, section: { object: true } } },
      order: { id: 'ASC', stops: { position: 'ASC' } },
    });
    const locations = await this.locationRepo.createQueryBuilder('location')
      .distinctOn(['location.userId'])
      .leftJoinAndSelect('location.user', 'user')
      .leftJoinAndSelect('location.brigade', 'brigade')
      .leftJoinAndSelect('location.route', 'route')
      .where('location.recordedAt >= :from', evidenceRange(date, date, process.env.BUSINESS_UTC_OFFSET || '+05:00'))
      .orderBy('location.userId', 'ASC')
      .addOrderBy('location.recordedAt', 'DESC')
      .getMany();
    const [sections, vehicles, attendance, recentEvents, problemExecutions] = await Promise.all([
      this.sectionRepo.find({ relations: { object: true } }),
      this.vehicleRepo.find({ relations: { responsibleUser: true, assignments: { brigade: true, route: true } } }),
      this.attendanceRepo.find({ where: { workDate: date }, order: { checkInTime: 'ASC' } }),
      this.eventRepo.find({ relations: { actor: true, execution: { task: true, section: { object: true } } }, order: { occurredAt: 'DESC' }, take: 40 }),
      this.executionRepo.find({ where: [{ status: ExecutionStatus.REJECTED }, { status: ExecutionStatus.COMPLETED }], relations: { task: true, section: { object: true }, worker: true }, order: { updatedAt: 'DESC' }, take: 30 }),
    ]);
    const now = new Date();
    const activeAssignments = vehicles.flatMap((vehicle) => (vehicle.assignments ?? []).filter((assignment) => [VehicleAssignmentStatus.ASSIGNED, VehicleAssignmentStatus.ACTIVE].includes(assignment.status)).map((assignment) => ({ vehicleId: vehicle.id, vehicleName: vehicle.name, vehicleType: vehicle.type, status: vehicle.status, brigade: assignment.brigade?.name ?? null, routeId: assignment.routeId, startsAt: assignment.startsAt })));
    const overdueStops = routes.flatMap((route) => route.stops.filter((stop) => stop.plannedArrivalAt && stop.plannedArrivalAt < now && !['ARRIVED', 'IN_PROGRESS', 'COMPLETED', 'SKIPPED'].includes(stop.status)).map((stop) => ({ routeId: route.id, brigade: route.brigade.name, stopId: stop.id, object: stop.section.object?.name ?? null, plannedArrivalAt: stop.plannedArrivalAt })));
    const shiftThreshold = process.env.SHIFT_LATE_AFTER || '09:15';
    const timeFormatter = new Intl.DateTimeFormat('en-GB', { timeZone: process.env.BUSINESS_TIME_ZONE || 'Asia/Oral', hour: '2-digit', minute: '2-digit', hour12: false });
    const late = attendance.filter((row) => timeFormatter.format(row.checkInTime) > shiftThreshold);
    return {
      date,
      generatedAt: now,
      summary: {
        checkedIn: attendance.length,
        late: late.length,
        activeBrigades: new Set(routes.filter((route) => route.status === RouteStatus.IN_PROGRESS).map((route) => route.brigadeId)).size,
        routes: routes.length,
        activeVehicles: activeAssignments.length,
        waterTrucks: vehicles.filter((vehicle) => vehicle.type === VehicleType.WATER_TRUCK).length,
        overdueStops: overdueStops.length,
        problems: problemExecutions.length,
      },
      objects: sections.filter((section) => section.latitude != null && section.longitude != null).map((section) => ({ sectionId: section.id, sectionName: section.name, objectId: section.objectId, objectName: section.object?.name ?? null, latitude: section.latitude, longitude: section.longitude, radiusMeters: section.radiusMeters })),
      teams: locations.map((location) => ({ userId: location.userId, userName: location.user.fullName, brigadeId: location.brigadeId, brigadeName: location.brigade?.name ?? null, routeId: location.routeId, latitude: location.latitude, longitude: location.longitude, accuracy: location.accuracy, recordedAt: location.recordedAt, stale: now.getTime() - location.recordedAt.getTime() > 15 * 60_000 })),
      routes,
      activeAssignments,
      overdueStops,
      problems: problemExecutions.map((execution) => ({ executionId: execution.id, status: execution.status, taskId: execution.taskId, task: execution.task.description, object: execution.section.object?.name ?? null, worker: execution.worker.fullName, updatedAt: execution.updatedAt })),
      events: recentEvents.map((event) => ({ id: event.id, type: event.type, occurredAt: event.occurredAt, actor: event.actor?.fullName ?? null, executionId: event.executionId, task: event.execution?.task?.description ?? null, object: event.execution?.section?.object?.name ?? null })),
    };
  }
}
