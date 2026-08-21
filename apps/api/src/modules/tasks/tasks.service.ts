import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { parsePhotoUrls, serializePhotoUrls } from '../../common/photo-urls';
import { TaskCategory } from '../../common/enums/task-category.enum';
import { TaskStatus } from '../../common/enums/task-status.enum';
import { UserRole } from '../../common/enums/user-role.enum';
import { Section } from '../../entities/section.entity';
import { Task } from '../../entities/task.entity';
import { User } from '../../entities/user.entity';
import { WorkType } from '../../entities/work-type.entity';
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
  ) {}

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
    if (reviewer.role === UserRole.ADMIN) return;
    if (reviewer.role === UserRole.AGRONOMIST && task.createdById === reviewer.id) return;
    throw new ForbiddenException('Недостаточно прав для проверки задачи');
  }

  private assertCanViewTask(task: ReturnType<typeof this.mapTask>, user: User) {
    if (user.role === UserRole.ADMIN) return;
    if (user.role === UserRole.AGRONOMIST && task.createdById === user.id) return;
    if (user.role === UserRole.BRIGADIER && task.assigneeUserId === user.id) return;
    throw new ForbiddenException('Нет доступа к этой задаче');
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
    return this.mapMyTask(row);
  }

  async acceptTask(id: number, user: User) {
    this.assertCanUseMyTasks(user);
    const row = await this.getTaskForAssignee(id, user);
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
      qb.andWhere('task.assigneeUserId = :userId', { userId: user.id });
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

  async findOpenForSection(sectionId: number) {
    const rows = await this.baseQuery()
      .where('task.sectionId = :sectionId', { sectionId })
      .andWhere('task.status IN (:...statuses)', {
        statuses: [TaskStatus.ASSIGNED, TaskStatus.ACCEPTED, TaskStatus.IN_PROGRESS],
      })
      .orderBy('task.dueDate', 'ASC', 'NULLS LAST')
      .getMany();
    return rows.map((r) => this.mapTask(r));
  }

  async findOne(id: number) {
    const row = await this.baseQuery().where('task.id = :id', { id }).getOne();
    if (!row) throw new NotFoundException('Задача не найдена');
    return this.mapTask(row);
  }

  async create(dto: CreateTaskDto, createdBy: User) {
    const section = await this.sectionRepo.findOne({ where: { id: dto.sectionId } });
    if (!section) throw new NotFoundException('Участок не найден');

    const wt = await this.workTypeRepo.findOne({ where: { id: dto.workTypeId } });
    if (!wt) throw new NotFoundException('Вид работы не найден');

    const assignee = await this.userRepo.findOne({ where: { id: dto.assigneeUserId } });
    if (!assignee || !assignee.isActive) {
      throw new BadRequestException('Выбранный исполнитель не найден или неактивен');
    }
    if (assignee.role === UserRole.ADMIN) {
      throw new BadRequestException('Администратор не может быть исполнителем задачи');
    }

    const category =
      dto.category ??
      (createdBy.role === UserRole.AGRONOMIST ? TaskCategory.AGRO : TaskCategory.WORK);

    const row = this.taskRepo.create({
      sectionId: dto.sectionId,
      workTypeId: dto.workTypeId,
      assigneeUserId: dto.assigneeUserId,
      brigadeId: dto.brigadeId ?? assignee.brigadeId ?? null,
      dueDate: dto.dueDate,
      priority: dto.priority,
      description: dto.description.trim(),
      status: dto.status ?? TaskStatus.ASSIGNED,
      category,
      createdById: createdBy.id,
    });
    const saved = await this.taskRepo.save(row);
    return this.findOne(saved.id);
  }

  async update(id: number, dto: UpdateTaskDto) {
    const row = await this.taskRepo.findOne({ where: { id } });
    if (!row) throw new NotFoundException('Задача не найдена');

    if (dto.sectionId !== undefined) row.sectionId = dto.sectionId;
    if (dto.workTypeId !== undefined) row.workTypeId = dto.workTypeId;
    if (dto.assigneeUserId !== undefined) row.assigneeUserId = dto.assigneeUserId;
    if (dto.brigadeId !== undefined) row.brigadeId = dto.brigadeId;
    if (dto.dueDate !== undefined) row.dueDate = dto.dueDate;
    if (dto.priority !== undefined) row.priority = dto.priority;
    if (dto.description !== undefined) row.description = dto.description.trim();
    if (dto.status !== undefined) row.status = dto.status;
    if (dto.category !== undefined) row.category = dto.category;

    await this.taskRepo.save(row);
    return this.findOne(id);
  }

  async remove(id: number) {
    const row = await this.taskRepo.findOne({ where: { id } });
    if (!row) throw new NotFoundException('Задача не найдена');
    await this.taskRepo.remove(row);
  }
}

