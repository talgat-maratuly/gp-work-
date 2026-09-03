import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserRole } from '../../common/enums/user-role.enum';
import { Section, Task, User, WorkDaySession, WorkDayStatus, WorkExecution } from '../../entities';
import { distanceMeters } from './field-execution.rules';
import { CloseWorkDayDto, ReviewWorkDayDto, StartWorkDayDto } from './dto/work-day.dto';

function shiftDate() { return new Intl.DateTimeFormat('en-CA', { timeZone: process.env.BUSINESS_TIME_ZONE || 'Asia/Oral' }).format(new Date()); }

@Injectable()
export class WorkDaysService {
  constructor(
    @InjectRepository(WorkDaySession) private readonly sessions: Repository<WorkDaySession>,
    @InjectRepository(Section) private readonly sections: Repository<Section>,
    @InjectRepository(Task) private readonly tasks: Repository<Task>,
    @InjectRepository(WorkExecution) private readonly executions: Repository<WorkExecution>,
  ) {}

  private async sectionAndDistance(code: string, lat: number, lon: number, accuracy?: number) {
    const section = await this.sections.findOne({ where: { code: code.trim() }, relations: { object: true } });
    if (!section) throw new NotFoundException('QR участка не найден');
    let distance: number | null = null;
    if (section.latitude != null && section.longitude != null) {
      distance = distanceMeters(lat, lon, section.latitude, section.longitude);
      if (distance > (section.radiusMeters ?? 150) + Math.max(accuracy ?? 0, 20)) throw new BadRequestException(`Вы вне геозоны участка (${Math.round(distance)} м)`);
    }
    return { section, distance };
  }

  async state(sectionCode: string, user: User) {
    const section = await this.sections.findOne({ where: { code: sectionCode }, relations: { object: true } });
    if (!section) throw new NotFoundException('QR участка не найден');
    const session = await this.sessions.findOne({ where: { userId: user.id, status: WorkDayStatus.OPEN }, relations: { section: { object: true } } });
    const tasks = await this.tasks.createQueryBuilder('task').leftJoinAndSelect('task.workType', 'workType').leftJoinAndMapOne('task.execution', WorkExecution, 'execution', 'execution.task_id = task.id').where('task.section_id = :sectionId', { sectionId: section.id }).andWhere('(task.assignee_user_id = :userId OR task.brigade_id = :brigadeId)', { userId: user.id, brigadeId: user.brigadeId ?? -1 }).getMany();
    return { section, session, tasks, serverTime: new Date().toISOString(), action: session ? 'CONTINUE_OR_CLOSE' : 'START' };
  }

  async start(dto: StartWorkDayDto, user: User) {
    const duplicate = await this.sessions.findOne({ where: { clientSessionId: dto.clientSessionId } });
    if (duplicate) { if (duplicate.userId !== user.id) throw new BadRequestException('Идентификатор смены уже использован'); return duplicate; }
    if (await this.sessions.exist({ where: { userId: user.id, status: WorkDayStatus.OPEN } })) throw new BadRequestException('У работника уже есть открытая смена');
    const { section, distance } = await this.sectionAndDistance(dto.sectionCode, dto.latitude, dto.longitude, dto.accuracy);
    const now = new Date();
    return this.sessions.save(this.sessions.create({ clientSessionId: dto.clientSessionId, userId: user.id, sectionId: section.id, shiftDate: shiftDate(), status: WorkDayStatus.OPEN, startedAt: now, closedAt: null, startQr: section.code, endQr: null, startLatitude: dto.latitude, startLongitude: dto.longitude, startAccuracy: dto.accuracy ?? null, startDistanceMeters: distance, endLatitude: null, endLongitude: null, endAccuracy: null, endDistanceMeters: null, startSelfieUrl: dto.selfieUrl, endSelfieUrl: null, startPhotoUrl: dto.startPhotoUrl, resultPhotoUrls: [], overallPercent: 0, summary: null, incompleteReasons: {}, events: [{ type: 'STARTED', at: now.toISOString(), livenessFrames: dto.livenessEvidenceUrls.length }], reviewedById: null, reviewedAt: null, reviewComment: null }));
  }

  async close(dto: CloseWorkDayDto, user: User) {
    const session = await this.sessions.findOne({ where: { id: dto.sessionId }, relations: { section: true } });
    if (!session) throw new NotFoundException('Смена не найдена');
    if (session.userId !== user.id) throw new ForbiddenException('Нельзя закрыть чужую смену');
    if (session.status !== WorkDayStatus.OPEN) return session;
    if (session.section.code !== dto.sectionCode.trim()) throw new BadRequestException('Для закрытия отсканируйте QR текущего участка');
    const { distance } = await this.sectionAndDistance(dto.sectionCode, dto.latitude, dto.longitude, dto.accuracy);
    const active = await this.executions.createQueryBuilder('e').where('e.worker_user_id = :userId', { userId: user.id }).andWhere('e.status IN (:...s)', { s: ['STARTED', 'IN_PROGRESS', 'REJECTED'] }).getMany();
    const resultMap = new Map(dto.results.map(r => [r.taskId, r]));
    for (const execution of active) {
      const result = resultMap.get(execution.taskId);
      if (!result) throw new BadRequestException(`Для задачи ${execution.taskId} нет результата`);
      if (result.percent < 100 && !result.incompleteReason?.trim()) throw new BadRequestException(`Для незавершённой задачи ${execution.taskId} укажите причину`);
    }
    const overall = dto.results.length ? Math.round(dto.results.reduce((s, r) => s + r.percent, 0) / dto.results.length) : 0;
    const now = new Date();
    Object.assign(session, { status: WorkDayStatus.CLOSED, closedAt: now, endQr: dto.sectionCode.trim(), endLatitude: dto.latitude, endLongitude: dto.longitude, endAccuracy: dto.accuracy ?? null, endDistanceMeters: distance, endSelfieUrl: dto.selfieUrl, resultPhotoUrls: dto.resultPhotoUrls, overallPercent: overall, summary: dto.summary?.trim() || null, incompleteReasons: Object.fromEntries(dto.results.filter(r => r.percent < 100).map(r => [String(r.taskId), r.incompleteReason!.trim()])), events: [...session.events, { type: 'CLOSED', at: now.toISOString(), results: dto.results, livenessFrames: dto.livenessEvidenceUrls.length }] });
    return this.sessions.save(session);
  }

  list() { return this.sessions.find({ relations: { user: true, section: { object: true } }, order: { startedAt: 'DESC' } }); }
  async review(id: number, dto: ReviewWorkDayDto, reviewer: User) {
    const row = await this.sessions.findOne({ where: { id } }); if (!row) throw new NotFoundException('Смена не найдена');
    if (![UserRole.ADMIN, UserRole.DIRECTOR, UserRole.BRIGADIER, UserRole.AGRONOMIST].includes(reviewer.role)) throw new ForbiddenException();
    row.status = dto.accepted ? WorkDayStatus.REVIEWED : WorkDayStatus.RETURNED; row.reviewedById = reviewer.id; row.reviewedAt = new Date(); row.reviewComment = dto.comment?.trim() || null;
    row.events = [...row.events, { type: dto.accepted ? 'REVIEWED' : 'RETURNED', at: row.reviewedAt.toISOString(), actorUserId: reviewer.id, comment: row.reviewComment }]; return this.sessions.save(row);
  }
}
