import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { endOfDay, format, startOfDay, subDays } from 'date-fns';
import { Repository } from 'typeorm';
import { AiPlantStatus } from '../../common/enums/ai-plant-status.enum';
import { AttendanceStatus } from '../../common/enums/attendance-status.enum';
import { ReviewStatus } from '../../common/enums/review-status.enum';
import { TaskStatus } from '../../common/enums/task-status.enum';
import { AiAgronomAnalysis } from '../../entities/ai-agronom-analysis.entity';
import { AttendanceRecord } from '../../entities/attendance-record.entity';
import { Brigade } from '../../entities/brigade.entity';
import { NurseryObject } from '../../entities/nursery-object.entity';
import { Product } from '../../entities/product.entity';
import { Section } from '../../entities/section.entity';
import { Task } from '../../entities/task.entity';
import { User } from '../../entities/user.entity';
import { WorkLog } from '../../entities/work-log.entity';
import { WorkDaySession, WorkDayStatus } from '../../entities/work-day-session.entity';
import { WorkExecution } from '../../entities/work-execution.entity';
import { AdminAiQuestionDto } from './dto/admin-ai-question.dto';

type RiskLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';

type RiskItem = {
  level: RiskLevel;
  title: string;
  description: string;
  recommendation: string;
  source: string;
};

function num(value: string | number | null | undefined): number {
  if (value == null) return 0;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function parsePhotoUrls(raw: string): string[] {
  try {
    const value = JSON.parse(raw) as unknown;
    return Array.isArray(value) ? value.map(String) : [];
  } catch {
    return [];
  }
}

@Injectable()
export class AdminAiService {
  private readonly logger = new Logger(AdminAiService.name);

  constructor(
    private readonly configService: ConfigService,
    @InjectRepository(WorkLog)
    private readonly workLogRepo: Repository<WorkLog>,
    @InjectRepository(AttendanceRecord)
    private readonly attendanceRepo: Repository<AttendanceRecord>,
    @InjectRepository(Task)
    private readonly taskRepo: Repository<Task>,
    @InjectRepository(Product)
    private readonly productRepo: Repository<Product>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    @InjectRepository(Brigade)
    private readonly brigadeRepo: Repository<Brigade>,
    @InjectRepository(NurseryObject)
    private readonly objectRepo: Repository<NurseryObject>,
    @InjectRepository(Section)
    private readonly sectionRepo: Repository<Section>,
    @InjectRepository(AiAgronomAnalysis)
    private readonly aiAgronomRepo: Repository<AiAgronomAnalysis>,
    @InjectRepository(WorkDaySession)
    private readonly workDayRepo: Repository<WorkDaySession>,
    @InjectRepository(WorkExecution)
    private readonly executionRepo: Repository<WorkExecution>,
  ) {}

  private todayRange() {
    const now = new Date();
    return {
      today: format(now, 'yyyy-MM-dd'),
      start: startOfDay(now),
      end: endOfDay(now),
    };
  }

  private async getTodayWorkLogs() {
    const { start, end } = this.todayRange();
    return this.workLogRepo
      .createQueryBuilder('workLog')
      .leftJoinAndSelect('workLog.section', 'section')
      .leftJoinAndSelect('section.object', 'object')
      .leftJoinAndSelect('workLog.workType', 'workType')
      .where('workLog.submittedAt >= :start', { start })
      .andWhere('workLog.submittedAt <= :end', { end })
      .orderBy('workLog.submittedAt', 'DESC')
      .getMany();
  }

  private async getOverdueTasks() {
    const { today } = this.todayRange();
    return this.taskRepo
      .createQueryBuilder('task')
      .leftJoinAndSelect('task.section', 'section')
      .leftJoinAndSelect('section.object', 'object')
      .leftJoinAndSelect('task.workType', 'workType')
      .leftJoinAndSelect('task.assignee', 'assignee')
      .leftJoinAndSelect('task.brigade', 'brigade')
      .where('task.dueDate IS NOT NULL')
      .andWhere('task.dueDate < :today', { today })
      .andWhere('task.status NOT IN (:...done)', {
        done: [TaskStatus.VERIFIED, TaskStatus.COMPLETED],
      })
      .orderBy('task.dueDate', 'ASC')
      .getMany();
  }

  private async getStaleSections(days = 7) {
    const threshold = subDays(new Date(), days);
    const sections = await this.sectionRepo.find({ relations: { object: true }, order: { code: 'ASC' } });
    const logs = await this.workLogRepo.find({
      select: { sectionId: true, submittedAt: true },
      order: { submittedAt: 'DESC' },
    });
    const lastBySection = new Map<number, Date>();
    for (const log of logs) {
      if (!lastBySection.has(log.sectionId)) lastBySection.set(log.sectionId, log.submittedAt);
    }
    return sections
      .map((section) => ({
        section,
        lastWork: lastBySection.get(section.id) ?? null,
      }))
      .filter((row) => !row.lastWork || row.lastWork < threshold);
  }

  private async getLowProducts() {
    const rows = await this.productRepo.find({ order: { currentQuantity: 'ASC' } });
    return rows.filter((p) => p.isActual && num(p.currentQuantity) <= 5);
  }

  private async buildRiskItems(): Promise<RiskItem[]> {
    const { today, start, end } = this.todayRange();
    const risks: RiskItem[] = [];

    const [attendance, overdueTasks, staleSections, lowProducts, pendingReports, todayLogs, objects, aiProblems] =
      await Promise.all([
        this.attendanceRepo.find({ where: { workDate: today }, order: { workerFullName: 'ASC' } }),
        this.getOverdueTasks(),
        this.getStaleSections(7),
        this.getLowProducts(),
        this.workLogRepo.find({ where: { reviewStatus: ReviewStatus.PENDING }, take: 50 }),
        this.getTodayWorkLogs(),
        this.objectRepo.find({ order: { name: 'ASC' } }),
        this.aiAgronomRepo.find({
          where: undefined,
          relations: { object: true, section: true },
          order: { createdAt: 'DESC' },
          take: 20,
        }),
      ]);

    for (const row of attendance.filter((a) => a.status === AttendanceStatus.ON_DUTY && !a.checkOutTime)) {
      risks.push({
        level: 'HIGH',
        title: `${row.workerFullName} не отметил уход`,
        description: `Сотрудник начал смену, но табель за сегодня не закрыт.`,
        recommendation: 'Связаться с сотрудником или закрыть незавершенный табель после проверки.',
        source: 'Табель',
      });
    }

    for (const task of overdueTasks.slice(0, 10)) {
      risks.push({
        level: task.priority === 'HIGH' ? 'URGENT' : 'HIGH',
        title: `Просрочена задача: ${task.description || task.workType?.name || `#${task.id}`}`,
        description: `Срок: ${task.dueDate}. Участок: ${task.section?.code ?? task.sectionId}. Статус: ${task.status}.`,
        recommendation: 'Назначить ответственного или проверить фактическое выполнение.',
        source: 'Задачи',
      });
    }

    for (const row of staleSections.slice(0, 10)) {
      const days = row.lastWork
        ? Math.floor((Date.now() - row.lastWork.getTime()) / 86_400_000)
        : null;
      risks.push({
        level: days == null || days > 14 ? 'HIGH' : 'MEDIUM',
        title: `Участок ${row.section.code} давно не обслуживался`,
        description: `${row.section.object?.name ?? 'Объект'} / ${row.section.name}: ${
          days == null ? 'нет отчетов' : `${days} дн. без работ`
        }.`,
        recommendation: 'Проверить участок и при необходимости назначить задачу.',
        source: 'Объекты и участки',
      });
    }

    for (const product of lowProducts.slice(0, 10)) {
      risks.push({
        level: num(product.currentQuantity) <= 0 ? 'URGENT' : 'MEDIUM',
        title: `Заканчивается товар: ${product.name}`,
        description: `Остаток: ${num(product.currentQuantity)} ${product.unit ?? ''}.`,
        recommendation: 'Пополнить склад или провести инвентаризацию.',
        source: 'Склад',
      });
    }

    const noPhoto = todayLogs.filter((log) => parsePhotoUrls(log.photoUrls).length === 0);
    if (noPhoto.length > 0) {
      risks.push({
        level: 'MEDIUM',
        title: `Есть отчеты без фото: ${noPhoto.length}`,
        description: 'Часть сегодняшних QR-отчетов отправлена без фотофиксации.',
        recommendation: 'Проверить отчеты и напомнить сотрудникам прикладывать фото.',
        source: 'Журнал работ',
      });
    }

    const noGeo = todayLogs.filter((log) => !log.latitude || !log.longitude);
    if (noGeo.length > 0) {
      risks.push({
        level: 'MEDIUM',
        title: `Есть отчеты без геолокации: ${noGeo.length}`,
        description: 'Часть сегодняшних QR-отчетов отправлена без координат.',
        recommendation: 'Проверить настройки геолокации на устройствах сотрудников.',
        source: 'Журнал работ',
      });
    }

    if (pendingReports.length > 0) {
      risks.push({
        level: pendingReports.length >= 10 ? 'HIGH' : 'LOW',
        title: `Отчеты требуют проверки: ${pendingReports.length}`,
        description: 'В журнале есть отчеты со статусом ожидания проверки.',
        recommendation: 'Открыть журнал работ и проверить новые отчеты.',
        source: 'Журнал работ',
      });
    }

    const todayObjects = new Set(todayLogs.map((log) => log.section?.object?.id).filter(Boolean));
    for (const object of objects) {
      if (!todayObjects.has(object.id)) {
        risks.push({
          level: 'LOW',
          title: `По объекту "${object.name}" сегодня нет отчетов`,
          description: 'За текущий день по объекту не зафиксированы QR-отчеты.',
          recommendation: 'Проверить план работ по объекту.',
          source: 'Объекты',
        });
      }
    }

    for (const analysis of aiProblems.filter((a) => [AiPlantStatus.BAD, AiPlantStatus.CRITICAL].includes(a.status))) {
      risks.push({
        level: analysis.status === AiPlantStatus.CRITICAL ? 'URGENT' : 'HIGH',
        title: `AI-анализ отметил проблему: ${analysis.object?.name ?? 'объект'}`,
        description: `${analysis.section?.code ?? 'участок не указан'}: ${analysis.aiComment}`,
        recommendation: 'Проверить участок и назначить агрономическую задачу.',
        source: 'AI-анализ',
      });
    }

    risks.sort((a, b) => {
      const rank: Record<RiskLevel, number> = { URGENT: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };
      return rank[a.level] - rank[b.level];
    });

    return risks;
  }

  async getSummary() {
    const { today } = this.todayRange();
    const [todayLogs, attendance, overdueTasks, staleSections, lowProducts, pendingReports, risks] =
      await Promise.all([
        this.getTodayWorkLogs(),
        this.attendanceRepo.find({ where: { workDate: today } }),
        this.getOverdueTasks(),
        this.getStaleSections(7),
        this.getLowProducts(),
        this.workLogRepo.count({ where: { reviewStatus: ReviewStatus.PENDING } }),
        this.buildRiskItems(),
      ]);

    const openAttendance = attendance.filter((row) => !row.checkOutTime);
    const summaryLines = [
      `Сегодня выполнено QR-отчетов: ${todayLogs.length}.`,
      `На работу вышло сотрудников: ${attendance.length}.`,
      `Не отметили уход: ${openAttendance.length}.`,
      `Просроченных задач: ${overdueTasks.length}.`,
      `Участков без обслуживания более 7 дней: ${staleSections.length}.`,
      `Товаров с низким остатком: ${lowProducts.length}.`,
      `Отчетов ожидают проверки: ${pendingReports}.`,
    ];

    return {
      date: today,
      completedWorksToday: todayLogs.length,
      employeesCheckedInToday: attendance.length,
      employeesWithoutCheckout: openAttendance.map((row) => row.workerFullName),
      overdueTasks: overdueTasks.length,
      staleSections: staleSections.slice(0, 10).map((row) => ({
        id: row.section.id,
        code: row.section.code,
        name: row.section.name,
        objectName: row.section.object?.name ?? '—',
        lastWork: row.lastWork,
      })),
      lowStockProducts: lowProducts.slice(0, 10).map((product) => ({
        id: product.id,
        name: product.name,
        article: product.article,
        currentQuantity: num(product.currentQuantity),
        unit: product.unit,
      })),
      reportsPendingReview: pendingReports,
      summary: summaryLines.join(' '),
      recommendations: risks.slice(0, 8).map((risk) => risk.recommendation),
    };
  }

  async getRisks() {
    return this.buildRiskItems();
  }

  async getWorkerBrief(user: User) {
    const today = this.todayRange().today;
    const tasks = await this.taskRepo
      .createQueryBuilder('task')
      .leftJoinAndSelect('task.section', 'section')
      .leftJoinAndSelect('section.object', 'object')
      .leftJoinAndSelect('task.workType', 'workType')
      .leftJoinAndMapOne('task.execution', WorkExecution, 'execution', 'execution.task_id = task.id')
      .where('(task.assignee_user_id = :userId OR task.brigade_id = :brigadeId)', {
        userId: user.id,
        brigadeId: user.brigadeId ?? -1,
      })
      .andWhere('(task.due_date IS NULL OR task.due_date <= :today)', { today })
      .andWhere('task.status NOT IN (:...done)', { done: [TaskStatus.VERIFIED] })
      .orderBy('task.due_date', 'ASC', 'NULLS LAST')
      .addOrderBy('task.id', 'ASC')
      .getMany();

    const openDay = await this.workDayRepo.findOne({
      where: { userId: user.id, status: WorkDayStatus.OPEN },
      relations: { section: { object: true } },
    });

    const rows = tasks.map((task) => {
      const execution = (task as Task & { execution?: WorkExecution | null }).execution ?? null;
      const status = execution?.status ?? 'ASSIGNED';
      const nextAction =
        status === 'ASSIGNED'
          ? 'Отсканируйте QR участка и подтвердите геолокацию.'
          : status === 'ARRIVED'
            ? 'Сделайте селфи и фото ДО начала работы.'
            : status === 'STARTED' || status === 'IN_PROGRESS'
              ? 'Выполните чек-лист и добавьте фото результата.'
              : status === 'COMPLETED'
                ? 'Работа отправлена руководителю на проверку.'
                : status === 'REJECTED'
                  ? 'Откройте замечание руководителя и исправьте работу.'
                  : 'Дополнительных действий по задаче сейчас нет.';
      return {
        id: task.id,
        title: task.description || task.workType?.name || `Задача #${task.id}`,
        dueDate: task.dueDate,
        objectName: task.section?.object?.name ?? '—',
        sectionName: task.section?.name ?? '—',
        sectionCode: task.section?.code ?? '—',
        status,
        nextAction,
      };
    });

    const activeCount = rows.filter((task) => ['ARRIVED', 'STARTED', 'IN_PROGRESS'].includes(task.status)).length;
    const problemCount = rows.filter((task) => task.status === 'REJECTED').length;
    const recommendations = [
      !openDay
        ? 'Для начала рабочего дня отсканируйте QR участка, включите GPS и пройдите проверку лица.'
        : `Рабочий день открыт на участке ${openDay.section?.object?.name ?? '—'} / ${openDay.section?.name ?? '—'}.`,
      rows[0]?.nextAction ?? 'На сегодня назначенных задач нет. Уточните план у руководителя.',
      openDay ? 'Перед уходом закройте рабочий день: QR, GPS, селфи, фото результата и процент выполнения.' : null,
    ].filter((item): item is string => Boolean(item));

    return {
      date: today,
      worker: { id: user.id, fullName: user.fullName, role: user.role },
      workDay: openDay
        ? {
            id: openDay.id,
            status: openDay.status,
            startedAt: openDay.startedAt,
            objectName: openDay.section?.object?.name ?? '—',
            sectionName: openDay.section?.name ?? '—',
            sectionCode: openDay.section?.code ?? '—',
          }
        : null,
      metrics: { total: rows.length, active: activeCount, problems: problemCount },
      tasks: rows,
      recommendations,
      summary: openDay
        ? `Рабочий день открыт. Задач: ${rows.length}, в работе: ${activeCount}, с замечаниями: ${problemCount}.`
        : `Рабочий день ещё не открыт. На сегодня задач: ${rows.length}.`,
    };
  }

  async answerWorkerQuestion(dto: AdminAiQuestionDto, user: User) {
    const apiKey = this.configService.get<string>('OPENAI_API_KEY');
    if (!apiKey) {
      const brief = await this.getWorkerBrief(user);
      return {
        answer: this.buildWorkerFallbackAnswer(dto.question, brief),
        model: 'gp-work-rules',
        fallback: true,
      };
    }

    const model = this.configService.get<string>('OPENAI_WORKER_MODEL', 'gpt-4o-mini');
    const brief = await this.getWorkerBrief(user);
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        temperature: 0.2,
        messages: [
          {
            role: 'system',
            content:
              'Ты ИИ-ассистент сотрудника GP Work. Отвечай по-русски, просто, коротко и пошагово. Используй только данные этого сотрудника. Не придумывай факты, не меняй задачи и данные, не принимай кадровые или финансовые решения. Напоминай про QR, GPS, селфи, фото ДО/ПОСЛЕ, чек-лист и закрытие рабочего дня, когда это уместно.',
          },
          {
            role: 'user',
            content: `Вопрос сотрудника: ${dto.question}\n\nЕго текущий рабочий день:\n${JSON.stringify(brief, null, 2)}`,
          },
        ],
      }),
    });
    if (!response.ok) {
      const providerError = await response.text();
      this.logger.warn(`OpenAI worker request failed (${response.status}): ${providerError.slice(0, 500)}`);
      return {
        answer: this.buildWorkerFallbackAnswer(dto.question, brief),
        model: 'gp-work-rules',
        fallback: true,
      };
    }
    const body = (await response.json()) as { choices?: { message?: { content?: string } }[] };
    const answer = body.choices?.[0]?.message?.content?.trim();
    if (!answer) throw new BadRequestException('ИИ-ассистент не вернул ответ');
    return { answer, model };
  }

  async answerQuestion(dto: AdminAiQuestionDto) {
    const apiKey = this.configService.get<string>('OPENAI_API_KEY');
    const model = this.configService.get<string>('OPENAI_ADMIN_MODEL', 'gpt-4o-mini');
    const [todayLogs, attendance, overdueTasks, staleSections, lowProducts, risks, summary] = await Promise.all([
      this.getTodayWorkLogs(),
      this.attendanceRepo.find({ where: { workDate: this.todayRange().today } }),
      this.getOverdueTasks(),
      this.getStaleSections(7),
      this.getLowProducts(),
      this.buildRiskItems(),
      this.getSummary(),
    ]);

    const context = {
      today: this.todayRange().today,
      summary,
      currentMetrics: {
        workReportsToday: todayLogs.length,
        employeesInAttendance: attendance.length,
        employeesWithoutCheckout: attendance.filter((row) => !row.checkOutTime).map((row) => row.workerFullName),
        overdueTasks: overdueTasks.slice(0, 15).map((task) => ({
          id: task.id,
          title: task.description || task.workType?.name || `#${task.id}`,
          dueDate: task.dueDate,
          status: task.status,
          object: task.section?.object?.name ?? null,
          section: task.section?.code ?? null,
        })),
        staleSections: staleSections.slice(0, 15).map((row) => ({
          id: row.section.id,
          code: row.section.code,
          name: row.section.name,
          object: row.section.object?.name ?? null,
          lastWork: row.lastWork,
        })),
        lowStockProducts: lowProducts.slice(0, 15).map((product) => ({
          id: product.id,
          name: product.name,
          article: product.article,
          currentQuantity: num(product.currentQuantity),
          unit: product.unit,
        })),
      },
      risks: risks.slice(0, 20),
    };

    if (!apiKey) {
      return {
        answer: this.buildAdminFallbackAnswer(dto.question, context),
        model: 'gp-work-rules',
        fallback: true,
      };
    }

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        temperature: 0.2,
        messages: [
          {
            role: 'system',
            content:
              'Ты ИИ-директор GP Work. Отвечай по-русски, кратко и по делу. Используй только переданный контекст системы, не выдумывай отсутствующие данные. Выделяй факты, риски, причины и рекомендуемые действия. Ты не увольняешь сотрудников, не назначаешь штрафы, не удаляешь данные и не меняешь production. Любое кадровое, финансовое или необратимое действие требует явного подтверждения владельца.',
          },
          {
            role: 'user',
            content: `Вопрос администратора: ${dto.question}\n\nДанные платформы:\n${JSON.stringify(context, null, 2)}`,
          },
        ],
      }),
    });

    if (!response.ok) {
      const providerError = await response.text();
      this.logger.warn(`OpenAI admin request failed (${response.status}): ${providerError.slice(0, 500)}`);
      return {
        answer: this.buildAdminFallbackAnswer(dto.question, context),
        model: 'gp-work-rules',
        fallback: true,
      };
    }

    const body = (await response.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    const answer = body.choices?.[0]?.message?.content?.trim();
    if (!answer) {
      throw new BadRequestException('ИИ-директор не вернул ответ');
    }

    return {
      answer,
      model,
    };
  }

  private buildWorkerFallbackAnswer(question: string, brief: Awaited<ReturnType<AdminAiService['getWorkerBrief']>>) {
    const normalized = question.toLowerCase();
    if (normalized.includes('задач')) {
      if (brief.tasks.length === 0) return 'На сегодня назначенных задач нет. Уточните план у руководителя.';
      return brief.tasks
        .slice(0, 5)
        .map((task, index) => `${index + 1}. ${task.title} — ${task.objectName}, ${task.sectionCode}. ${task.nextAction}`)
        .join('\n');
    }
    return [brief.summary, ...brief.recommendations].join('\n');
  }

  private buildAdminFallbackAnswer(
    question: string,
    context: {
      summary: Awaited<ReturnType<AdminAiService['getSummary']>>;
      currentMetrics: {
        employeesWithoutCheckout: string[];
        overdueTasks: { id: number; title: string; dueDate: string | null }[];
        staleSections: { code: string; object: string | null }[];
        lowStockProducts: { name: string; currentQuantity: number; unit: string | null }[];
      };
      risks: RiskItem[];
    },
  ): string {
    const normalized = question.toLowerCase();
    const metrics = context.currentMetrics;

    if (normalized.includes('не ушел') || normalized.includes('не отметил')) {
      return metrics.employeesWithoutCheckout.length
        ? `Не отметили уход: ${metrics.employeesWithoutCheckout.join(', ')}.`
        : 'Все вышедшие сотрудники отметили уход.';
    }
    if (normalized.includes('просроч')) {
      return metrics.overdueTasks.length
        ? metrics.overdueTasks.map((task) => `#${task.id} ${task.title} — срок ${task.dueDate ?? 'не указан'}`).join('\n')
        : 'Просроченных задач нет.';
    }
    if (normalized.includes('участ') || normalized.includes('обслуж')) {
      return metrics.staleSections.length
        ? metrics.staleSections.map((row) => `${row.object ?? 'Объект'} / ${row.code}`).join('\n')
        : 'Участков без обслуживания более 7 дней нет.';
    }
    if (normalized.includes('товар') || normalized.includes('склад') || normalized.includes('остат')) {
      return metrics.lowStockProducts.length
        ? metrics.lowStockProducts
            .map((product) => `${product.name}: ${product.currentQuantity} ${product.unit ?? ''}`.trim())
            .join('\n')
        : 'Товаров с низким остатком нет.';
    }

    const priorities = context.risks.slice(0, 5).map((risk, index) => `${index + 1}. ${risk.title}: ${risk.recommendation}`);
    return [context.summary.summary, priorities.length ? `\nПриоритеты:\n${priorities.join('\n')}` : ''].join('');
  }
}
