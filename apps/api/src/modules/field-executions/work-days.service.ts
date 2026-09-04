import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { businessDateString } from '../../common/business-date';
import { TaskStatus } from '../../common/enums/task-status.enum';
import { UserRole } from '../../common/enums/user-role.enum';
import { Section, Task, User, WorkDaySession, WorkDayStatus, WorkExecution } from '../../entities';
import type { WorkDayTaskResult } from '../../entities/work-day-session.entity';
import { UploadsService } from '../uploads/uploads.service';
import { AttendanceService } from '../attendance/attendance.service';
import { assertFreshLivenessEvidence, distanceMeters } from './field-execution.rules';
import { CloseWorkDayDto, ReviewWorkDayDto, StartWorkDayDto } from './dto/work-day.dto';

@Injectable()
export class WorkDaysService {
  constructor(
    @InjectRepository(WorkDaySession) private readonly sessions: Repository<WorkDaySession>,
    @InjectRepository(Section) private readonly sections: Repository<Section>,
    @InjectRepository(Task) private readonly tasks: Repository<Task>,
    @InjectRepository(WorkExecution) private readonly executions: Repository<WorkExecution>,
    private readonly uploadsService: UploadsService,
    private readonly attendanceService: AttendanceService,
  ) {}

  private assignedTasks(sectionId: number, user: User, includeExecution = false) {
    const query = this.tasks
      .createQueryBuilder('task')
      .leftJoinAndSelect('task.workType', 'workType')
      .where('task.section_id = :sectionId', { sectionId })
      .andWhere('(task.assignee_user_id = :userId OR task.brigade_id = :brigadeId)', {
        userId: user.id,
        brigadeId: user.brigadeId ?? -1,
      })
      .andWhere('task.status NOT IN (:...closed)', {
        closed: [TaskStatus.COMPLETED, TaskStatus.VERIFIED, TaskStatus.CANCELLED],
      })
      .orderBy('task.id', 'ASC');
    if (includeExecution) {
      query.leftJoinAndMapOne(
        'task.execution',
        WorkExecution,
        'execution',
        'execution.task_id = task.id',
      );
    }
    return query.getMany();
  }

  private async sessionTasks(session: WorkDaySession, user: User, includeExecution = false) {
    const taskIds = session.taskScope?.map((task) => task.taskId) ?? [];
    if (!taskIds.length) return this.assignedTasks(session.sectionId, user, includeExecution);
    const query = this.tasks
      .createQueryBuilder('task')
      .leftJoinAndSelect('task.workType', 'workType')
      .where('task.id IN (:...taskIds)', { taskIds })
      .andWhere('task.section_id = :sectionId', { sectionId: session.sectionId })
      .orderBy('task.id', 'ASC');
    if (includeExecution) {
      query.leftJoinAndMapOne(
        'task.execution',
        WorkExecution,
        'execution',
        'execution.task_id = task.id',
      );
    }
    return query.getMany();
  }

  private async sectionAndDistance(code: string, lat: number, lon: number, accuracy?: number) {
    const section = await this.sections.findOne({
      where: { code: code.trim(), isActive: true, object: { isActive: true } },
      relations: { object: true },
    });
    if (!section) throw new NotFoundException('QR участка не найден');
    let distance: number | null = null;
    if (section.latitude != null && section.longitude != null) {
      distance = distanceMeters(lat, lon, section.latitude, section.longitude);
      if (distance > (section.radiusMeters ?? 150) + Math.max(accuracy ?? 0, 20)) throw new BadRequestException(`Вы вне геозоны участка (${Math.round(distance)} м)`);
    }
    return { section, distance };
  }

  async state(sectionCode: string, user: User) {
    const section = await this.sections.findOne({
      where: { code: sectionCode.trim(), isActive: true, object: { isActive: true } },
      relations: { object: true },
    });
    if (!section) throw new NotFoundException('QR участка не найден');
    const session = await this.sessions.findOne({
      where: { userId: user.id, status: In([WorkDayStatus.OPEN, WorkDayStatus.RETURNED]) },
      relations: { section: { object: true } },
      order: { startedAt: 'DESC' },
    });
    if (session && session.sectionId !== section.id) {
      throw new BadRequestException(
        `Текущая смена относится к участку «${session.section.name}». Отсканируйте его QR`,
      );
    }
    const tasks = session
      ? await this.sessionTasks(session, user, true)
      : await this.assignedTasks(section.id, user, true);
    return {
      section,
      session,
      tasks,
      serverTime: new Date().toISOString(),
      action: session?.status === WorkDayStatus.RETURNED
        ? 'CORRECT_AND_CLOSE'
        : session
          ? 'CONTINUE_OR_CLOSE'
          : 'START',
    };
  }

  async start(dto: StartWorkDayDto, user: User) {
    assertFreshLivenessEvidence(dto.selfieUrl, dto.livenessEvidenceUrls);
    const duplicate = await this.sessions.findOne({ where: { clientSessionId: dto.clientSessionId } });
    if (duplicate) {
      if (
        duplicate.userId !== user.id ||
        duplicate.startQr !== dto.sectionCode.trim() ||
        duplicate.startSelfieUrl !== dto.selfieUrl ||
        JSON.stringify(duplicate.startLivenessEvidenceUrls) !== JSON.stringify(dto.livenessEvidenceUrls) ||
        duplicate.startPhotoUrl !== dto.startPhotoUrl
      ) {
        throw new BadRequestException('Идентификатор смены уже использован для других данных');
      }
      await this.attendanceService.syncOnWorkDayStarted(duplicate, user);
      return duplicate;
    }
    if (await this.sessions.exist({ where: { userId: user.id, status: In([WorkDayStatus.OPEN, WorkDayStatus.RETURNED]) } })) throw new BadRequestException('У работника уже есть открытая или возвращённая смена');
    const { section, distance } = await this.sectionAndDistance(dto.sectionCode, dto.latitude, dto.longitude, dto.accuracy);
    await this.uploadsService.assertStoredPhotoUrls([
      dto.selfieUrl,
      ...dto.livenessEvidenceUrls,
      dto.startPhotoUrl,
    ]);
    const assignedTasks = await this.assignedTasks(section.id, user);
    if (!assignedTasks.length) {
      throw new BadRequestException('На этом участке вам не назначена ни одна активная задача');
    }
    const now = new Date();
    return this.sessions.manager.transaction(async (manager) => {
      const saved = await manager.getRepository(WorkDaySession).save(manager.getRepository(WorkDaySession).create({ clientSessionId: dto.clientSessionId, userId: user.id, sectionId: section.id, shiftDate: businessDateString(), status: WorkDayStatus.OPEN, startedAt: now, closedAt: null, startQr: section.code, endQr: null, startLatitude: dto.latitude, startLongitude: dto.longitude, startAccuracy: dto.accuracy ?? null, startDistanceMeters: distance, endLatitude: null, endLongitude: null, endAccuracy: null, endDistanceMeters: null, startSelfieUrl: dto.selfieUrl, endSelfieUrl: null, startLivenessEvidenceUrls: dto.livenessEvidenceUrls, endLivenessEvidenceUrls: [], startPhotoUrl: dto.startPhotoUrl, resultPhotoUrls: [], taskScope: assignedTasks.map((task) => ({ taskId: task.id, description: task.description })), taskResults: [], overallPercent: 0, summary: null, incompleteReasons: {}, events: [{ type: 'STARTED', at: now.toISOString(), selfieUrl: dto.selfieUrl, livenessEvidenceUrls: dto.livenessEvidenceUrls, startPhotoUrl: dto.startPhotoUrl }], reviewedById: null, reviewedAt: null, reviewComment: null }));
      await this.attendanceService.syncOnWorkDayStarted(saved, user, manager);
      return saved;
    });
  }

  async close(dto: CloseWorkDayDto, user: User) {
    const session = await this.sessions.findOne({ where: { id: dto.sessionId }, relations: { section: true } });
    if (!session) throw new NotFoundException('Смена не найдена');
    if (session.userId !== user.id) throw new ForbiddenException('Нельзя закрыть чужую смену');
    if (![WorkDayStatus.OPEN, WorkDayStatus.RETURNED].includes(session.status)) {
      const repeatedResults = dto.results.map((result) => ({
        taskId: result.taskId,
        percent: result.percent,
        actualVolume: result.actualVolume?.trim() || null,
        workDescription: result.description?.trim() || null,
        incompleteReason: result.percent < 100 ? result.incompleteReason?.trim() || null : null,
      }));
      if (
        session.endQr !== dto.sectionCode.trim() ||
        session.endSelfieUrl !== dto.selfieUrl ||
        JSON.stringify(session.endLivenessEvidenceUrls) !== JSON.stringify(dto.livenessEvidenceUrls) ||
        JSON.stringify(session.resultPhotoUrls) !== JSON.stringify(dto.resultPhotoUrls) ||
        JSON.stringify(session.taskResults.map(({ description: _description, ...result }) => result)) !== JSON.stringify(repeatedResults)
      ) {
        throw new BadRequestException('Смена уже закрыта с другими итоговыми данными');
      }
      await this.attendanceService.syncOnWorkDayClosed(session, user);
      return session;
    }
    const previousEndLiveness = session.endLivenessEvidenceUrls ?? [];
    const previousResultPhotos = session.resultPhotoUrls ?? [];
    assertFreshLivenessEvidence(
      dto.selfieUrl,
      dto.livenessEvidenceUrls,
      [...(session.startLivenessEvidenceUrls ?? []), ...previousEndLiveness],
    );
    if (
      session.status === WorkDayStatus.RETURNED &&
      !dto.resultPhotoUrls.some((url) => !previousResultPhotos.includes(url))
    ) {
      throw new BadRequestException('После возврата добавьте новое фото результата');
    }
    if (session.section.code !== dto.sectionCode.trim()) throw new BadRequestException('Для закрытия отсканируйте QR текущего участка');
    const { distance } = await this.sectionAndDistance(dto.sectionCode, dto.latitude, dto.longitude, dto.accuracy);
    await this.uploadsService.assertStoredPhotoUrls([
      dto.selfieUrl,
      ...dto.livenessEvidenceUrls,
      ...dto.resultPhotoUrls,
    ]);
    const active = await this.executions.createQueryBuilder('e').where('e.worker_user_id = :userId', { userId: user.id }).andWhere('e.section_id = :sectionId', { sectionId: session.sectionId }).andWhere('e.status IN (:...s)', { s: ['STARTED', 'IN_PROGRESS', 'REJECTED'] }).getMany();
    const currentTasks = await this.sessionTasks(session, user);
    const taskScope = session.taskScope?.length
      ? session.taskScope
      : currentTasks.map((task) => ({ taskId: task.id, description: task.description }));
    const resultIds = dto.results.map((result) => result.taskId);
    if (new Set(resultIds).size !== resultIds.length) {
      throw new BadRequestException('Результат одной задачи не должен повторяться');
    }
    const resultMap = new Map(dto.results.map(r => [r.taskId, r]));
    const assignedMap = new Map(taskScope.map((task) => [task.taskId, task]));
    for (const result of dto.results) {
      if (!assignedMap.has(result.taskId)) {
        throw new BadRequestException(`Задача ${result.taskId} не относится к этой смене`);
      }
      if (result.percent > 0 && !result.description?.trim()) {
        throw new BadRequestException(`Для задачи ${result.taskId} укажите, что выполнено`);
      }
      if (result.percent < 100 && !result.incompleteReason?.trim()) {
        throw new BadRequestException(`Для незавершённой задачи ${result.taskId} укажите причину`);
      }
    }
    for (const task of taskScope) {
      if (!resultMap.has(task.taskId)) {
        throw new BadRequestException(`Для задачи ${task.taskId} нет результата`);
      }
    }
    for (const execution of active) {
      const result = resultMap.get(execution.taskId);
      if (!result) throw new BadRequestException(`Для задачи ${execution.taskId} нет результата`);
      if (result.percent < 100 && !result.incompleteReason?.trim()) throw new BadRequestException(`Для незавершённой задачи ${execution.taskId} укажите причину`);
    }
    const taskResults: WorkDayTaskResult[] = dto.results.map((result) => ({
      taskId: result.taskId,
      description: assignedMap.get(result.taskId)!.description,
      percent: result.percent,
      actualVolume: result.actualVolume?.trim() || null,
      workDescription: result.description?.trim() || null,
      incompleteReason: result.percent < 100 ? result.incompleteReason?.trim() || null : null,
    }));
    const overall = Math.round(taskResults.reduce((sum, result) => sum + result.percent, 0) / taskResults.length);
    const now = new Date();
    const closingEvent = session.status === WorkDayStatus.RETURNED ? 'RESUBMITTED' : 'CLOSED';
    Object.assign(session, { status: WorkDayStatus.CLOSED, closedAt: now, endQr: dto.sectionCode.trim(), endLatitude: dto.latitude, endLongitude: dto.longitude, endAccuracy: dto.accuracy ?? null, endDistanceMeters: distance, endSelfieUrl: dto.selfieUrl, endLivenessEvidenceUrls: dto.livenessEvidenceUrls, resultPhotoUrls: dto.resultPhotoUrls, taskResults, overallPercent: overall, summary: dto.summary?.trim() || null, incompleteReasons: Object.fromEntries(taskResults.filter(r => r.percent < 100).map(r => [String(r.taskId), r.incompleteReason!])), reviewedById: null, reviewedAt: null, reviewComment: null, events: [...session.events, { type: closingEvent, at: now.toISOString(), results: taskResults, selfieUrl: dto.selfieUrl, livenessEvidenceUrls: dto.livenessEvidenceUrls, resultPhotoUrls: dto.resultPhotoUrls }] });
    return this.sessions.manager.transaction(async (manager) => {
      const saved = await manager.getRepository(WorkDaySession).save(session);
      await this.attendanceService.syncOnWorkDayClosed(saved, user, manager);
      return saved;
    });
  }

  list() { return this.sessions.find({ relations: { user: true, section: { object: true } }, order: { startedAt: 'DESC' } }); }
  async review(id: number, dto: ReviewWorkDayDto, reviewer: User) {
    const row = await this.sessions.findOne({ where: { id } }); if (!row) throw new NotFoundException('Смена не найдена');
    if (![UserRole.ADMIN, UserRole.DIRECTOR, UserRole.BRIGADIER, UserRole.AGRONOMIST].includes(reviewer.role)) throw new ForbiddenException();
    if (row.status !== WorkDayStatus.CLOSED) throw new BadRequestException('Можно проверить только завершённую смену');
    if (!dto.accepted && !dto.comment?.trim()) throw new BadRequestException('При возврате обязательно укажите причину');
    row.status = dto.accepted ? WorkDayStatus.REVIEWED : WorkDayStatus.RETURNED; row.reviewedById = reviewer.id; row.reviewedAt = new Date(); row.reviewComment = dto.comment?.trim() || null;
    row.events = [...row.events, { type: dto.accepted ? 'REVIEWED' : 'RETURNED', at: row.reviewedAt.toISOString(), actorUserId: reviewer.id, comment: row.reviewComment }]; return this.sessions.save(row);
  }
}
