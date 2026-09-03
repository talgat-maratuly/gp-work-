import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import {
  ExecutionStatus,
  FaceVerificationStatus,
  RouteStopStatus,
  WorkPhotoPhase,
} from '../../common/enums/field-execution.enums';
import { TaskStatus } from '../../common/enums/task-status.enum';
import { UserRole } from '../../common/enums/user-role.enum';
import { serializePhotoUrls } from '../../common/photo-urls';
import {
  ChecklistAnswer,
  ChecklistItem,
  FaceVerification,
  LocationEvent,
  RouteStop,
  Section,
  Task,
  User,
  WorkExecution,
  WorkExecutionEvent,
  WorkLog,
  WorkPhoto,
} from '../../entities';
import { AttendanceService } from '../attendance/attendance.service';
import {
  AddWorkPhotosDto,
  ArriveExecutionDto,
  CaptureFaceDto,
  ExecutionActionDto,
  LocationBatchDto,
  ReviewExecutionDto,
  ReviewFaceDto,
  SaveChecklistDto,
} from './dto/field-execution.dto';
import { assertTransition, distanceMeters } from './field-execution.rules';

function businessDate(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: process.env.BUSINESS_TIME_ZONE || 'Asia/Oral',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

@Injectable()
export class FieldExecutionsService {
  constructor(
    @InjectRepository(WorkExecution) private readonly executionRepo: Repository<WorkExecution>,
    @InjectRepository(WorkExecutionEvent) private readonly eventRepo: Repository<WorkExecutionEvent>,
    @InjectRepository(WorkPhoto) private readonly photoRepo: Repository<WorkPhoto>,
    @InjectRepository(ChecklistItem) private readonly checklistItemRepo: Repository<ChecklistItem>,
    @InjectRepository(ChecklistAnswer) private readonly checklistAnswerRepo: Repository<ChecklistAnswer>,
    @InjectRepository(FaceVerification) private readonly faceRepo: Repository<FaceVerification>,
    @InjectRepository(LocationEvent) private readonly locationRepo: Repository<LocationEvent>,
    @InjectRepository(RouteStop) private readonly stopRepo: Repository<RouteStop>,
    @InjectRepository(Task) private readonly taskRepo: Repository<Task>,
    @InjectRepository(Section) private readonly sectionRepo: Repository<Section>,
    @InjectRepository(WorkLog) private readonly workLogRepo: Repository<WorkLog>,
    private readonly attendanceService: AttendanceService,
  ) {}

  private baseQuery() {
    return this.executionRepo
      .createQueryBuilder('execution')
      .leftJoinAndSelect('execution.task', 'task')
      .leftJoinAndSelect('task.workType', 'workType')
      .leftJoinAndSelect('execution.section', 'section')
      .leftJoinAndSelect('section.object', 'object')
      .leftJoinAndSelect('execution.worker', 'worker')
      .leftJoinAndSelect('execution.brigade', 'brigade')
      .leftJoinAndSelect('execution.routeStop', 'routeStop')
      .leftJoinAndSelect('execution.acceptedBy', 'acceptedBy');
  }

  private async detailed(id: number) {
    const execution = await this.baseQuery().where('execution.id = :id', { id }).getOne();
    if (!execution) throw new NotFoundException('Выполнение работы не найдено');
    const [events, photos, checklist, faceVerifications] = await Promise.all([
      this.eventRepo.find({ where: { executionId: id }, order: { occurredAt: 'ASC' } }),
      this.photoRepo.find({ where: { executionId: id }, order: { capturedAt: 'ASC' } }),
      this.checklistAnswerRepo.find({ where: { executionId: id }, relations: { item: true }, order: { itemId: 'ASC' } }),
      this.faceRepo.find({ where: { executionId: id }, relations: { user: true, reviewedBy: true }, order: { createdAt: 'DESC' } }),
    ]);
    const availableChecklist = await this.getRequiredItems(execution.task.workTypeId);
    return { ...execution, events, photos, checklist, availableChecklist, faceVerifications };
  }

  private canExecute(task: Task, user: User): boolean {
    return task.assigneeUserId === user.id || (!!task.brigadeId && task.brigadeId === user.brigadeId);
  }

  private canReview(execution: WorkExecution, user: User): boolean {
    if (user.role === UserRole.ADMIN || user.role === UserRole.DIRECTOR) return true;
    if (user.role === UserRole.BRIGADIER) return !!execution.brigadeId && execution.brigadeId === user.brigadeId;
    return user.role === UserRole.AGRONOMIST && execution.task.createdById === user.id;
  }

  private async owned(id: number, user: User) {
    const execution = await this.baseQuery().where('execution.id = :id', { id }).getOne();
    if (!execution) throw new NotFoundException('Выполнение работы не найдено');
    if (!this.canExecute(execution.task, user)) throw new ForbiddenException('Работа назначена другому сотруднику или бригаде');
    return execution;
  }

  async findOneForUser(id: number, user: User) {
    const execution = await this.baseQuery().where('execution.id = :id', { id }).getOne();
    if (!execution) throw new NotFoundException('Выполнение работы не найдено');
    const management = [UserRole.ADMIN, UserRole.DIRECTOR, UserRole.AGRONOMIST].includes(user.role);
    if (!management && !this.canExecute(execution.task, user)) throw new ForbiddenException('Нет доступа к этой работе');
    return this.detailed(id);
  }

  async today(user: User) {
    const date = businessDate();
    const qb = this.taskRepo
      .createQueryBuilder('task')
      .leftJoinAndSelect('task.section', 'section')
      .leftJoinAndSelect('section.object', 'object')
      .leftJoinAndSelect('task.workType', 'workType')
      .leftJoinAndSelect('task.brigade', 'brigade')
      .leftJoinAndMapOne('task.execution', WorkExecution, 'execution', 'execution.task_id = task.id')
      .where('(task.assignee_user_id = :userId OR task.brigade_id = :brigadeId)', {
        userId: user.id,
        brigadeId: user.brigadeId ?? -1,
      })
      .andWhere('(task.due_date IS NULL OR task.due_date <= :date)', { date })
      .andWhere('task.status NOT IN (:...done)', { done: [TaskStatus.VERIFIED] })
      .orderBy('task.due_date', 'ASC', 'NULLS LAST')
      .addOrderBy('task.id', 'ASC');
    return { date, tasks: await qb.getMany() };
  }

  reviewQueue() {
    return this.baseQuery()
      .where('execution.status = :status', { status: ExecutionStatus.COMPLETED })
      .orderBy('execution.completedAt', 'ASC')
      .getMany();
  }

  private async eventAlreadyProcessed(clientOperationId: string): Promise<WorkExecution | null> {
    const event = await this.eventRepo.findOne({ where: { clientOperationId } });
    if (!event) return null;
    return this.executionRepo.findOne({ where: { id: event.executionId } });
  }

  private async recordEvent(
    execution: WorkExecution,
    type: string,
    dto: ExecutionActionDto,
    user: User,
    payload: Record<string, unknown> = {},
    geo?: { latitude?: number; longitude?: number; accuracy?: number },
  ) {
    const existing = await this.eventRepo.findOne({ where: { clientOperationId: dto.clientOperationId } });
    if (existing) return existing;
    return this.eventRepo.save(this.eventRepo.create({
      clientOperationId: dto.clientOperationId,
      executionId: execution.id,
      actorUserId: user.id,
      type,
      payload,
      latitude: geo?.latitude ?? null,
      longitude: geo?.longitude ?? null,
      accuracy: geo?.accuracy ?? null,
      occurredAt: dto.occurredAt ? new Date(dto.occurredAt) : new Date(),
    }));
  }

  async arrive(taskId: number, dto: ArriveExecutionDto, user: User) {
    const duplicate = await this.eventAlreadyProcessed(dto.clientOperationId);
    if (duplicate) return this.detailed(duplicate.id);
    const task = await this.taskRepo.findOne({ where: { id: taskId }, relations: { section: true } });
    if (!task) throw new NotFoundException('Задача не найдена');
    if (!this.canExecute(task, user)) throw new ForbiddenException('Задача назначена другому сотруднику или бригаде');
    if (task.section.code !== dto.sectionCode.trim()) throw new BadRequestException('QR-код не относится к объекту задачи');

    let measuredDistance: number | null = null;
    if (task.section.latitude != null && task.section.longitude != null) {
      measuredDistance = distanceMeters(dto.latitude, dto.longitude, task.section.latitude, task.section.longitude);
      const allowed = task.section.radiusMeters ?? 150;
      const tolerance = Math.max(dto.accuracy ?? 0, 20);
      if (measuredDistance > allowed + tolerance) {
        throw new BadRequestException(`Вы находитесь вне допустимого радиуса объекта (${Math.round(measuredDistance)} м)`);
      }
    }

    let stop: RouteStop | null = null;
    if (dto.routeStopId) {
      stop = await this.stopRepo.findOne({ where: { id: dto.routeStopId } });
      if (!stop || stop.taskId !== task.id) throw new BadRequestException('Остановка маршрута не соответствует задаче');
    }

    let execution = await this.executionRepo.findOne({ where: { taskId } });
    if (!execution) {
      execution = await this.executionRepo.save(this.executionRepo.create({
        clientExecutionId: dto.clientExecutionId,
        taskId: task.id,
        sectionId: task.sectionId,
        workerUserId: user.id,
        brigadeId: task.brigadeId ?? user.brigadeId ?? null,
        routeStopId: stop?.id ?? null,
        status: ExecutionStatus.ARRIVED,
        qrVerifiedAt: new Date(),
        arrivedAt: new Date(),
        arrivalLatitude: dto.latitude,
        arrivalLongitude: dto.longitude,
        arrivalAccuracy: dto.accuracy ?? null,
        arrivalDistanceMeters: measuredDistance,
      }));
    } else {
      if (execution.workerUserId !== user.id) throw new ForbiddenException('Выполнение уже начато другим сотрудником');
      if (execution.status !== ExecutionStatus.ARRIVED) assertTransition(execution.status, ExecutionStatus.ARRIVED);
      execution.status = ExecutionStatus.ARRIVED;
      execution.qrVerifiedAt = execution.qrVerifiedAt ?? new Date();
      execution.arrivedAt = execution.arrivedAt ?? new Date();
      execution.arrivalLatitude = dto.latitude;
      execution.arrivalLongitude = dto.longitude;
      execution.arrivalAccuracy = dto.accuracy ?? null;
      execution.arrivalDistanceMeters = measuredDistance;
      await this.executionRepo.save(execution);
    }

    if (stop) {
      stop.status = RouteStopStatus.ARRIVED;
      stop.arrivedAt = new Date();
      stop.arrivalLatitude = dto.latitude;
      stop.arrivalLongitude = dto.longitude;
      stop.arrivalAccuracy = dto.accuracy ?? null;
      stop.distanceMeters = measuredDistance;
      await this.stopRepo.save(stop);
    }
    await this.recordEvent(execution, 'ARRIVED', dto, user, { sectionCode: dto.sectionCode, routeStopId: dto.routeStopId }, dto);
    return this.detailed(execution.id);
  }

  async captureFace(id: number, dto: CaptureFaceDto, user: User) {
    const execution = await this.owned(id, user);
    const existing = await this.faceRepo.findOne({ where: { clientOperationId: dto.clientOperationId } });
    if (!existing) {
      await this.faceRepo.save(this.faceRepo.create({
        clientOperationId: dto.clientOperationId,
        executionId: execution.id,
        userId: user.id,
        status: FaceVerificationStatus.PENDING,
        selfieUrl: dto.selfieUrl,
        livenessEvidenceUrls: dto.livenessEvidenceUrls,
      }));
      await this.recordEvent(execution, 'FACE_CAPTURED', { clientOperationId: dto.clientOperationId }, user);
    }
    return this.detailed(id);
  }

  async reviewFace(verificationId: number, dto: ReviewFaceDto, reviewer: User) {
    if (![FaceVerificationStatus.VERIFIED, FaceVerificationStatus.REJECTED].includes(dto.status)) {
      throw new BadRequestException('Некорректный результат Face verification');
    }
    const face = await this.faceRepo.findOne({ where: { id: verificationId }, relations: { execution: { task: true }, user: true } });
    if (!face) throw new NotFoundException('Face verification не найдена');
    if (!this.canReview(face.execution, reviewer)) throw new ForbiddenException('Нет доступа к проверке этого сотрудника');
    face.status = dto.status;
    face.reviewedById = reviewer.id;
    face.reviewedAt = new Date();
    face.reviewComment = dto.reviewComment?.trim() || null;
    await this.faceRepo.save(face);
    return this.detailed(face.executionId);
  }

  async addPhotos(id: number, dto: AddWorkPhotosDto, user: User) {
    const execution = await this.owned(id, user);
    for (const photo of dto.photos) {
      const existing = await this.photoRepo.findOne({ where: { clientPhotoId: photo.clientPhotoId } });
      if (existing) continue;
      await this.photoRepo.save(this.photoRepo.create({
        clientPhotoId: photo.clientPhotoId,
        executionId: execution.id,
        uploadedById: user.id,
        phase: photo.phase,
        url: photo.url,
        contentHash: photo.contentHash ?? null,
        capturedAt: new Date(photo.capturedAt),
        latitude: photo.latitude ?? null,
        longitude: photo.longitude ?? null,
      }));
    }
    return this.detailed(id);
  }

  async start(id: number, dto: ExecutionActionDto, user: User) {
    const duplicate = await this.eventAlreadyProcessed(dto.clientOperationId);
    if (duplicate) return this.detailed(duplicate.id);
    const execution = await this.owned(id, user);
    assertTransition(execution.status, ExecutionStatus.STARTED);
    const [beforeCount, faceCount] = await Promise.all([
      this.photoRepo.count({ where: { executionId: id, phase: WorkPhotoPhase.BEFORE } }),
      this.faceRepo.count({ where: { executionId: id } }),
    ]);
    if (!beforeCount) throw new BadRequestException('Перед началом работы обязательно сделайте фото ДО');
    if (!faceCount) throw new BadRequestException('Перед началом работы пройдите Face verification');
    execution.status = ExecutionStatus.STARTED;
    execution.startedAt = execution.startedAt ?? new Date();
    await this.executionRepo.save(execution);
    if (execution.routeStopId) await this.stopRepo.update(execution.routeStopId, { status: RouteStopStatus.IN_PROGRESS });
    if ([TaskStatus.ASSIGNED, TaskStatus.ACCEPTED, TaskStatus.REJECTED].includes(execution.task.status)) {
      execution.task.status = TaskStatus.IN_PROGRESS;
      await this.taskRepo.save(execution.task);
    }
    await this.recordEvent(execution, 'STARTED', dto, user, { comment: dto.comment });
    return this.detailed(id);
  }

  private getRequiredItems(workTypeId: number | null) {
    const qb = this.checklistItemRepo.createQueryBuilder('item').where('item.isActive = true');
    if (workTypeId) qb.andWhere('(item.workTypeId IS NULL OR item.workTypeId = :workTypeId)', { workTypeId });
    else qb.andWhere('item.workTypeId IS NULL');
    return qb.orderBy('item.position', 'ASC').getMany();
  }

  async saveChecklist(id: number, dto: SaveChecklistDto, user: User) {
    const duplicate = await this.eventAlreadyProcessed(dto.clientOperationId);
    if (duplicate) return this.detailed(duplicate.id);
    const execution = await this.owned(id, user);
    if (![ExecutionStatus.STARTED, ExecutionStatus.IN_PROGRESS, ExecutionStatus.REJECTED].includes(execution.status)) {
      throw new BadRequestException('Чек-лист доступен после начала работы');
    }
    const allowed = await this.getRequiredItems(execution.task.workTypeId);
    const allowedIds = new Set(allowed.map((item) => item.id));
    if (dto.answers.some((answer) => !allowedIds.has(answer.itemId))) throw new BadRequestException('Чек-лист содержит неизвестный пункт');
    const duplicateIds = dto.answers.map((answer) => answer.itemId);
    if (new Set(duplicateIds).size !== duplicateIds.length) throw new BadRequestException('Пункт чек-листа повторяется');
    for (const answer of dto.answers) {
      let row = await this.checklistAnswerRepo.findOne({ where: { executionId: id, itemId: answer.itemId } });
      row = row ?? this.checklistAnswerRepo.create({ executionId: id, itemId: answer.itemId });
      row.isCompleted = answer.isCompleted;
      row.comment = answer.comment?.trim() || null;
      row.completedById = answer.isCompleted ? user.id : null;
      row.completedAt = answer.isCompleted ? new Date() : null;
      await this.checklistAnswerRepo.save(row);
    }
    execution.status = ExecutionStatus.IN_PROGRESS;
    await this.executionRepo.save(execution);
    await this.recordEvent(execution, 'CHECKLIST_UPDATED', { clientOperationId: dto.clientOperationId }, user, { itemIds: duplicateIds });
    return this.detailed(id);
  }

  async complete(id: number, dto: ExecutionActionDto, user: User) {
    const duplicate = await this.eventAlreadyProcessed(dto.clientOperationId);
    if (duplicate) return this.detailed(duplicate.id);
    const execution = await this.owned(id, user);
    if (![ExecutionStatus.STARTED, ExecutionStatus.IN_PROGRESS, ExecutionStatus.REJECTED].includes(execution.status)) {
      throw new BadRequestException('Завершить можно только начатую работу');
    }
    const [beforeCount, afterCount, faceCount, requiredItems, answers] = await Promise.all([
      this.photoRepo.count({ where: { executionId: id, phase: WorkPhotoPhase.BEFORE } }),
      this.photoRepo.count({ where: { executionId: id, phase: WorkPhotoPhase.AFTER } }),
      this.faceRepo.count({ where: { executionId: id } }),
      this.getRequiredItems(execution.task.workTypeId),
      this.checklistAnswerRepo.find({ where: { executionId: id } }),
    ]);
    if (!beforeCount) throw new BadRequestException('Отсутствует обязательное фото ДО');
    if (!afterCount) throw new BadRequestException('Отсутствует обязательное фото ПОСЛЕ');
    if (!faceCount) throw new BadRequestException('Отсутствует Face verification');
    const completed = new Set(answers.filter((answer) => answer.isCompleted).map((answer) => answer.itemId));
    const missing = requiredItems.filter((item) => item.isRequired && !completed.has(item.id));
    if (missing.length) throw new BadRequestException(`Не выполнены обязательные пункты: ${missing.map((item) => item.label).join(', ')}`);

    execution.status = ExecutionStatus.COMPLETED;
    execution.completedAt = new Date();
    execution.comment = dto.comment?.trim() || execution.comment;
    await this.executionRepo.save(execution);
    execution.task.status = TaskStatus.COMPLETED;
    execution.task.completedAt = new Date();
    execution.task.completionComment = execution.comment;
    const photos = await this.photoRepo.find({ where: { executionId: id }, order: { capturedAt: 'ASC' } });
    execution.task.completionPhotoUrls = serializePhotoUrls(photos.map((photo) => photo.url));
    await this.taskRepo.save(execution.task);
    if (execution.routeStopId) await this.stopRepo.update(execution.routeStopId, { status: RouteStopStatus.COMPLETED });

    let workLog = await this.workLogRepo.findOne({ where: { executionId: id } });
    if (!workLog) {
      workLog = await this.workLogRepo.save(this.workLogRepo.create({
        sectionId: execution.sectionId,
        taskId: execution.taskId,
        userId: user.id,
        brigadeId: execution.brigadeId,
        executionId: execution.id,
        workerFullName: user.fullName,
        workTypeId: execution.task.workTypeId,
        customWorkType: null,
        workVolume: '100%',
        comment: execution.comment ?? '',
        photoUrls: serializePhotoUrls(photos.map((photo) => photo.url)),
        latitude: execution.arrivalLatitude,
        longitude: execution.arrivalLongitude,
        locationAccuracy: execution.arrivalAccuracy,
        locationAllowed: execution.arrivalLatitude != null && execution.arrivalLongitude != null,
        submittedAt: new Date(),
      }));
      await this.attendanceService.syncOnWorkLogCreated(workLog);
    }
    await this.recordEvent(execution, 'COMPLETED', dto, user, { workLogId: workLog.id, comment: dto.comment });
    return this.detailed(id);
  }

  async review(id: number, dto: ReviewExecutionDto, reviewer: User) {
    const duplicate = await this.eventAlreadyProcessed(dto.clientOperationId);
    if (duplicate) return this.detailed(duplicate.id);
    const execution = await this.baseQuery().where('execution.id = :id', { id }).getOne();
    if (!execution) throw new NotFoundException('Выполнение работы не найдено');
    if (!this.canReview(execution, reviewer)) throw new ForbiddenException('Нет доступа к приёмке этой работы');
    assertTransition(execution.status, dto.accepted ? ExecutionStatus.ACCEPTED : ExecutionStatus.REJECTED);
    if (dto.accepted) {
      const face = await this.faceRepo.findOne({ where: { executionId: id }, order: { createdAt: 'DESC' } });
      if (!face || face.status !== FaceVerificationStatus.VERIFIED) {
        throw new BadRequestException('Перед приёмкой руководитель должен подтвердить Face verification');
      }
      execution.status = ExecutionStatus.ACCEPTED;
      execution.acceptedAt = new Date();
      execution.acceptedById = reviewer.id;
      execution.task.status = TaskStatus.VERIFIED;
      execution.task.reviewedAt = new Date();
      execution.task.reviewedById = reviewer.id;
      execution.task.reviewComment = dto.comment?.trim() || null;
    } else {
      execution.status = ExecutionStatus.REJECTED;
      execution.reviewComment = dto.comment?.trim() || null;
      execution.task.status = TaskStatus.REJECTED;
      execution.task.reviewedAt = new Date();
      execution.task.reviewedById = reviewer.id;
      execution.task.reviewComment = execution.reviewComment;
    }
    await this.executionRepo.save(execution);
    await this.taskRepo.save(execution.task);
    await this.recordEvent(execution, dto.accepted ? 'ACCEPTED' : 'REJECTED', dto, reviewer, { comment: dto.comment });
    return this.detailed(id);
  }

  async addLocations(dto: LocationBatchDto, user: User) {
    const ids = dto.points.map((point) => point.clientOperationId);
    const existing = ids.length ? await this.locationRepo.find({ where: { clientOperationId: In(ids) } }) : [];
    const known = new Set(existing.map((row) => row.clientOperationId));
    const fresh = dto.points.filter((point) => !known.has(point.clientOperationId));
    if (fresh.length) {
      await this.locationRepo.save(fresh.map((point) => this.locationRepo.create({
        clientOperationId: point.clientOperationId,
        userId: user.id,
        brigadeId: user.brigadeId,
        routeId: point.routeId ?? null,
        latitude: point.latitude,
        longitude: point.longitude,
        accuracy: point.accuracy ?? null,
        recordedAt: point.occurredAt ? new Date(point.occurredAt) : new Date(),
      })));
    }
    return { received: dto.points.length, created: fresh.length, duplicates: existing.length };
  }
}
