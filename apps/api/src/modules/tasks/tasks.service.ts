import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, Repository } from 'typeorm';
import { parsePhotoUrls, serializePhotoUrls } from '../../common/photo-urls';
import { RouteStatus, RouteStopStatus } from '../../common/enums/field-execution.enums';
import { TaskCategory } from '../../common/enums/task-category.enum';
import { TaskStatus } from '../../common/enums/task-status.enum';
import { UserRole } from '../../common/enums/user-role.enum';
import { Section } from '../../entities/section.entity';
import { Task } from '../../entities/task.entity';
import { User } from '../../entities/user.entity';
import { WorkType } from '../../entities/work-type.entity';
import { Brigade, Route, RouteStop, WorkExecution } from '../../entities';
import { CompleteTaskDto, ReviewTaskDto } from './dto/complete-task.dto';
import { CreateTaskDto } from './dto/create-task.dto';
import { UpdateTaskDto } from './dto/update-task.dto';

@Injectable()
export class TasksService {
  constructor(
    @InjectRepository(Task)
    private readonly taskRepo: Repository<Task>,
    @InjectRepository(Section)
    private readonly sectionRepo: Repository<Section>,
    @InjectRepository(WorkType)
    private readonly workTypeRepo: Repository<WorkType>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    @InjectRepository(Brigade)
    private readonly brigadeRepo: Repository<Brigade>,
    private readonly dataSource: DataSource,
  ) {}

  private readonly executorRoles: UserRole[] = [
    UserRole.WORKER,
    UserRole.WATER_CARRIER,
    UserRole.BRIGADIER,
    UserRole.AGRONOMIST,
  ];

  private baseQuery() {
    return this.taskRepo
      .createQueryBuilder('task')
      .leftJoinAndSelect('task.section', 'section')
      .leftJoinAndSelect('section.object', 'object')
      .leftJoinAndSelect('task.workType', 'workType')
      .leftJoinAndSelect('task.assignee', 'assignee')
      .leftJoinAndSelect('task.brigade', 'brigade')
      .leftJoinAndSelect('task.createdBy', 'createdBy')
      .leftJoinAndSelect('task.reviewedBy', 'reviewedBy');
  }

  private mapTask(row: Task) {
    return {
      id: row.id,
      sectionId: row.sectionId,
      workTypeId: row.workTypeId,
      assigneeUserId: row.assigneeUserId,
      brigadeId: row.brigadeId,
      dueDate: row.dueDate,
      priority: row.priority,
      description: row.description,
      status: row.status,
      category: row.category,
      createdById: row.createdById,
      acceptedAt: row.acceptedAt,
      completedAt: row.completedAt,
      completionPhotoUrls: parsePhotoUrls(row.completionPhotoUrls),
      completionComment: row.completionComment,
      reviewedById: row.reviewedById,
      reviewedAt: row.reviewedAt,
      reviewComment: row.reviewComment,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      section: row.section,
      workType: row.workType,
      assignee: row.assignee,
      brigade: row.brigade,
      createdBy: row.createdBy,
      reviewedBy: row.reviewedBy,
    };
  }

  private mapMyTask(row: Task) {
    const mapped = this.mapTask(row);
    return {
      id: mapped.id,
      dueDate: mapped.dueDate,
      status: mapped.status,
      priority: mapped.priority,
      description: mapped.description,
      sectionName: mapped.section?.name ?? '—',
      sectionCode: mapped.section?.code ?? '—',
      objectName: mapped.section?.object?.name ?? '—',
      workTypeName: mapped.workType?.name ?? null,
      acceptedAt: mapped.acceptedAt,
      completedAt: mapped.completedAt,
      completionPhotoUrls: mapped.completionPhotoUrls,
      completionComment: mapped.completionComment,
      reviewedAt: mapped.reviewedAt,
      reviewComment: mapped.reviewComment,
    };
  }

  private isAssignee(task: Task, user: User): boolean {
    return task.assigneeUserId === user.id;
  }

  private async getTaskForAssignee(id: number, user: User) {
    const row = await this.baseQuery().where('task.id = :id', { id }).getOne();
    if (!row) throw new NotFoundException('Задача не найдена');
    if (!this.isAssignee(row, user)) {
      throw new ForbiddenException('Нет доступа к этой задаче');
    }
    return row;
  }

  private assertCanUseMyTasks(user: User) {
    if (user.role === UserRole.ADMIN) {
      throw new ForbiddenException('Администратор не является исполнителем задач');
    }
  }

  private assertCanReview(task: ReturnType<typeof this.mapTask>, reviewer: User) {
    if ([UserRole.ADMIN, UserRole.DIRECTOR].includes(reviewer.role)) return;
    if (reviewer.role === UserRole.AGRONOMIST && task.createdById === reviewer.id) return;
    throw new ForbiddenException('Недостаточно прав для проверки задачи');
  }

  private assertCanViewTask(task: ReturnType<typeof this.mapTask>, user: User) {
    if ([UserRole.ADMIN, UserRole.DIRECTOR].includes(user.role)) return;
    if (user.role === UserRole.AGRONOMIST && task.createdById === user.id) return;
    if (
      user.role === UserRole.BRIGADIER &&
      (task.assigneeUserId === user.id || (!!user.brigadeId && task.brigadeId === user.brigadeId))
    ) return;
    throw new ForbiddenException('Нет доступа к этой задаче');
  }

  private assertCanManageTask(task: Task, user: User) {
    if ([UserRole.ADMIN, UserRole.DIRECTOR].includes(user.role)) return;
    if (user.role === UserRole.AGRONOMIST && task.createdById === user.id) return;
    if (user.role === UserRole.BRIGADIER && !!user.brigadeId && task.brigadeId === user.brigadeId) return;
    throw new ForbiddenException('Нет права изменять эту задачу');
  }

  private async validateAssignment(
    values: { sectionId: number; workTypeId: number; assigneeUserId: number; brigadeId?: number },
    actor: User,
  ) {
    const [section, workType, assignee] = await Promise.all([
      this.sectionRepo.findOne({
        where: { id: values.sectionId, isActive: true, object: { isActive: true } },
        relations: { object: true },
      }),
      this.workTypeRepo.findOne({ where: { id: values.workTypeId, isActive: true } }),
      this.userRepo.findOne({ where: { id: values.assigneeUserId, isActive: true } }),
    ]);
    if (!section) throw new BadRequestException('Активный участок не найден');
    if (!workType) throw new BadRequestException('Активный вид работы не найден');
    if (!assignee || !this.executorRoles.includes(assignee.role)) {
      throw new BadRequestException('Выбранный исполнитель не найден, неактивен или не имеет полевой роли');
    }

    const brigadeId = values.brigadeId ?? assignee.brigadeId ?? null;
    if (brigadeId) {
      const brigade = await this.brigadeRepo.findOne({ where: { id: brigadeId, isActive: true } });
      if (!brigade) throw new BadRequestException('Активная бригада не найдена');
      if (assignee.brigadeId !== brigadeId) {
        throw new BadRequestException('Исполнитель не входит в выбранную бригаду');
      }
    }
    if (actor.role === UserRole.BRIGADIER) {
      if (!actor.brigadeId || brigadeId !== actor.brigadeId) {
        throw new ForbiddenException('Бригадир может назначать задачи только своей активной бригаде');
      }
    }
    return { brigadeId };
  }

  async findMyTasks(user: User) {
    this.assertCanUseMyTasks(user);
    const rows = await this.baseQuery()
      .where('task.assigneeUserId = :userId', { userId: user.id })
      .orderBy('task.dueDate', 'ASC', 'NULLS LAST')
      .getMany();
    return rows.map((r) => this.mapMyTask(r));
  }

  async findMyTask(id: number, user: User) {
    this.assertCanUseMyTasks(user);
    const row = await this.getTaskForAssignee(id, user);
    if (!row.section?.isActive || !row.section.object?.isActive) {
      throw new BadRequestException('Участок задачи находится в архиве');
    }
    return this.mapMyTask(row);
  }

  async acceptTask(id: number, user: User) {
    this.assertCanUseMyTasks(user);
    const row = await this.getTaskForAssignee(id, user);
    if (!row.section?.isActive || !row.section.object?.isActive) {
      throw new BadRequestException('Участок задачи находится в архиве');
    }
    if (row.status !== TaskStatus.ASSIGNED) {
      throw new BadRequestException('Задачу можно принять только в статусе «Новая»');
    }
    row.status = TaskStatus.ACCEPTED;
    row.acceptedAt = new Date();
    await this.taskRepo.save(row);
    return this.findMyTask(id, user);
  }

  async startTask(id: number, user: User) {
    this.assertCanUseMyTasks(user);
    const row = await this.getTaskForAssignee(id, user);
    if (row.status !== TaskStatus.ACCEPTED) {
      throw new BadRequestException('Начать работу можно только после принятия задачи');
    }
    row.status = TaskStatus.IN_PROGRESS;
    await this.taskRepo.save(row);
    return this.findMyTask(id, user);
  }

  async completeTask(id: number, user: User, dto: CompleteTaskDto) {
    this.assertCanUseMyTasks(user);
    const row = await this.getTaskForAssignee(id, user);
    if (row.status !== TaskStatus.IN_PROGRESS) {
      throw new BadRequestException('Завершить можно только задачу в статусе «В работе»');
    }
    if (!dto.photoUrls?.length) {
      throw new BadRequestException('Для завершения задачи обязательно прикрепите фото');
    }

    row.status = TaskStatus.COMPLETED;
    row.completedAt = new Date();
    row.completionPhotoUrls = serializePhotoUrls(dto.photoUrls);
    row.completionComment = dto.comment?.trim() || null;
    await this.taskRepo.save(row);
    return this.findMyTask(id, user);
  }

  async reviewTask(id: number, reviewer: User, dto: ReviewTaskDto) {
    const row = await this.taskRepo.findOne({ where: { id } });
    if (!row) throw new NotFoundException('Задача не найдена');
    const mapped = this.mapTask(row);
    this.assertCanReview(mapped, reviewer);
    if (row.status !== TaskStatus.COMPLETED) {
      throw new BadRequestException('Проверить можно только завершённую задачу');
    }

    row.status = dto.status;
    row.reviewedById = reviewer.id;
    row.reviewedAt = new Date();
    row.reviewComment = dto.reviewComment?.trim() || null;
    await this.taskRepo.save(row);
    return this.findOne(id);
  }

  async findAllForUser(user: User) {
    const qb = this.baseQuery().orderBy('task.dueDate', 'ASC', 'NULLS LAST');

    if (user.role === UserRole.BRIGADIER) {
      qb.andWhere('(task.assigneeUserId = :userId OR task.brigadeId = :brigadeId)', {
        userId: user.id,
        brigadeId: user.brigadeId ?? -1,
      });
    } else if (user.role === UserRole.AGRONOMIST) {
      qb.andWhere('task.createdById = :userId', { userId: user.id });
    }

    const rows = await qb.getMany();
    return rows.map((r) => this.mapTask(r));
  }

  async findOneForUser(id: number, user: User) {
    const task = await this.findOne(id);
    this.assertCanViewTask(task, user);
    return task;
  }

  async findOne(id: number) {
    const row = await this.baseQuery().where('task.id = :id', { id }).getOne();
    if (!row) throw new NotFoundException('Задача не найдена');
    return this.mapTask(row);
  }

  async create(dto: CreateTaskDto, createdBy: User) {
    const assignment = await this.validateAssignment(dto, createdBy);

    const category =
      createdBy.role === UserRole.AGRONOMIST
        ? TaskCategory.AGRO
        : createdBy.role === UserRole.BRIGADIER
          ? TaskCategory.WORK
          : dto.category ?? TaskCategory.WORK;

    const row = this.taskRepo.create({
      sectionId: dto.sectionId,
      workTypeId: dto.workTypeId,
      assigneeUserId: dto.assigneeUserId,
      brigadeId: assignment.brigadeId,
      dueDate: dto.dueDate,
      priority: dto.priority,
      description: dto.description.trim(),
      status: TaskStatus.ASSIGNED,
      category,
      createdById: createdBy.id,
    });
    const saved = await this.taskRepo.save(row);
    return this.findOne(saved.id);
  }

  async update(id: number, dto: UpdateTaskDto, actor: User) {
    await this.dataSource.transaction(async (manager) => {
      const row = await manager.getRepository(Task).findOne({
        where: { id },
        relations: {
          section: { object: true },
          workType: true,
          assignee: true,
          brigade: true,
          createdBy: true,
          reviewedBy: true,
        },
        lock: { mode: 'pessimistic_write' },
      });
      if (!row) throw new NotFoundException('Задача не найдена');
      this.assertCanManageTask(row, actor);
      if (row.status !== TaskStatus.ASSIGNED) {
        throw new BadRequestException('Изменять назначение можно только до принятия задачи');
      }

      const sectionId = dto.sectionId ?? row.sectionId;
      const workTypeId = dto.workTypeId ?? row.workTypeId;
      const assigneeUserId = dto.assigneeUserId ?? row.assigneeUserId;
      if (!workTypeId || !assigneeUserId) {
        throw new BadRequestException('У задачи отсутствует исполнитель или вид работы');
      }
      const assignment = await this.validateAssignment({
        sectionId,
        workTypeId,
        assigneeUserId,
        brigadeId: dto.brigadeId ?? (dto.assigneeUserId === undefined ? row.brigadeId ?? undefined : undefined),
      }, actor);

      row.sectionId = sectionId;
      row.workTypeId = workTypeId;
      row.assigneeUserId = assigneeUserId;
      row.brigadeId = assignment.brigadeId;
      if (dto.dueDate !== undefined) row.dueDate = dto.dueDate;
      if (dto.priority !== undefined) row.priority = dto.priority;
      if (dto.description !== undefined) row.description = dto.description.trim();
      await manager.getRepository(Task).save(row);
    });
    return this.findOne(id);
  }

  async remove(id: number, actor: User) {
    await this.dataSource.transaction(async (manager) => {
      const row = await manager.getRepository(Task).findOne({
        where: { id },
        lock: { mode: 'pessimistic_write' },
      });
      if (!row) throw new NotFoundException('Задача не найдена');
      this.assertCanManageTask(row, actor);
      if ([TaskStatus.IN_PROGRESS, TaskStatus.COMPLETED, TaskStatus.VERIFIED].includes(row.status)) {
        throw new BadRequestException('Нельзя отменить выполняемую или завершённую задачу');
      }
      const hasExecution = await manager.getRepository(WorkExecution).exist({ where: { taskId: id } });
      if (hasExecution) throw new BadRequestException('Нельзя отменить задачу с начатым доказательным выполнением');
      const stops = await manager.getRepository(RouteStop).find({ where: { taskId: id } });
      if (stops.some((stop) => [RouteStopStatus.ARRIVED, RouteStopStatus.IN_PROGRESS].includes(stop.status))) {
        throw new BadRequestException('Нельзя отменить задачу на активной точке маршрута');
      }
      const plannedStops = stops.filter((stop) => stop.status === RouteStopStatus.PLANNED);
      if (plannedStops.length) {
        await manager.getRepository(RouteStop).update(
          { id: In(plannedStops.map((stop) => stop.id)) },
          { status: RouteStopStatus.SKIPPED },
        );
      }
      row.status = TaskStatus.CANCELLED;
      await manager.getRepository(Task).save(row);

      const routeIds = [...new Set(stops.map((stop) => stop.routeId))];
      for (const routeId of routeIds) {
        const routeStops = await manager.getRepository(RouteStop).find({ where: { routeId } });
        if (routeStops.every((stop) => stop.status === RouteStopStatus.SKIPPED)) {
          await manager.getRepository(Route).update(routeId, { status: RouteStatus.CANCELLED, completedAt: new Date() });
        } else if (routeStops.every((stop) => [RouteStopStatus.COMPLETED, RouteStopStatus.SKIPPED].includes(stop.status))) {
          await manager.getRepository(Route).update(routeId, { status: RouteStatus.COMPLETED, completedAt: new Date() });
        }
      }
    });
  }
}
