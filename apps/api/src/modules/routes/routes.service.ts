import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { RouteStatus } from '../../common/enums/field-execution.enums';
import { TaskStatus } from '../../common/enums/task-status.enum';
import { UserRole } from '../../common/enums/user-role.enum';
import { Brigade, Route, RouteStop, Task, User } from '../../entities';
import { CreateRouteDto } from './dto/create-route.dto';

function businessDate(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: process.env.BUSINESS_TIME_ZONE || 'Asia/Oral',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

@Injectable()
export class RoutesService {
  constructor(
    @InjectRepository(Route) private readonly routeRepo: Repository<Route>,
    @InjectRepository(RouteStop) private readonly stopRepo: Repository<RouteStop>,
    @InjectRepository(Task) private readonly taskRepo: Repository<Task>,
    @InjectRepository(Brigade) private readonly brigadeRepo: Repository<Brigade>,
    private readonly dataSource: DataSource,
  ) {}

  private baseQuery() {
    return this.routeRepo
      .createQueryBuilder('route')
      .leftJoinAndSelect('route.brigade', 'brigade')
      .leftJoinAndSelect('route.stops', 'stop')
      .leftJoinAndSelect('stop.task', 'task')
      .leftJoinAndSelect('stop.section', 'section')
      .leftJoinAndSelect('section.object', 'object')
      .leftJoinAndSelect('task.workType', 'workType')
      .leftJoinAndSelect('task.assignee', 'assignee')
      .orderBy('route.workDate', 'DESC')
      .addOrderBy('stop.position', 'ASC');
  }

  findAll(date?: string) {
    const qb = this.baseQuery();
    if (date) qb.andWhere('route.workDate = :date', { date });
    return qb.getMany();
  }

  async findOne(id: number) {
    const route = await this.baseQuery().where('route.id = :id', { id }).getOne();
    if (!route) throw new NotFoundException('Маршрут не найден');
    return route;
  }

  async findOneForUser(id: number, user: User) {
    const route = await this.findOne(id);
    if (user.role !== UserRole.ADMIN && user.role !== UserRole.DIRECTOR && route.brigadeId !== user.brigadeId) {
      throw new ForbiddenException('Маршрут назначен другой бригаде');
    }
    return route;
  }

  findMyToday(user: User) {
    if (!user.brigadeId) return null;
    return this.baseQuery()
      .where('route.workDate = :date', { date: businessDate() })
      .andWhere('route.brigadeId = :brigadeId', { brigadeId: user.brigadeId })
      .getOne();
  }

  async create(dto: CreateRouteDto, user: User) {
    const brigade = await this.brigadeRepo.findOne({ where: { id: dto.brigadeId, isActive: true } });
    if (!brigade) throw new NotFoundException('Активная бригада не найдена');

    const ids = dto.stops.map((stop) => stop.taskId);
    if (new Set(ids).size !== ids.length) throw new BadRequestException('Одна задача не может повторяться в маршруте');
    const tasks = await this.taskRepo.createQueryBuilder('task').where('task.id IN (:...ids)', { ids }).getMany();
    if (tasks.length !== ids.length) throw new NotFoundException('Одна или несколько задач не найдены');
    for (const task of tasks) {
      if (task.brigadeId && task.brigadeId !== dto.brigadeId) {
        throw new BadRequestException(`Задача #${task.id} назначена другой бригаде`);
      }
      if ([TaskStatus.COMPLETED, TaskStatus.VERIFIED].includes(task.status)) {
        throw new BadRequestException(`Задача #${task.id} уже завершена`);
      }
    }

    const routeId = await this.dataSource.transaction(async (manager) => {
      const route = await manager.save(Route, manager.create(Route, {
        workDate: dto.workDate,
        brigadeId: dto.brigadeId,
        status: RouteStatus.PLANNED,
        comment: dto.comment?.trim() || null,
        createdById: user.id,
      }));
      const byId = new Map(tasks.map((task) => [task.id, task]));
      await manager.save(RouteStop, dto.stops.map((stop, index) => manager.create(RouteStop, {
        routeId: route.id,
        taskId: stop.taskId,
        sectionId: byId.get(stop.taskId)!.sectionId,
        position: index + 1,
        plannedArrivalAt: stop.plannedArrivalAt ? new Date(stop.plannedArrivalAt) : null,
      })));
      for (const task of tasks) {
        if (!task.brigadeId) task.brigadeId = dto.brigadeId;
        await manager.save(Task, task);
      }
      return route.id;
    });
    return this.findOne(routeId);
  }

  async start(id: number, user: User) {
    const route = await this.findOneForUser(id, user);
    if (route.status === RouteStatus.IN_PROGRESS) return route;
    if (route.status !== RouteStatus.PLANNED) throw new BadRequestException('Запустить можно только запланированный маршрут');
    route.status = RouteStatus.IN_PROGRESS;
    route.startedAt = new Date();
    await this.routeRepo.save(route);
    for (const stop of route.stops) {
      if (stop.task.status === TaskStatus.ASSIGNED) {
        stop.task.status = TaskStatus.ACCEPTED;
        stop.task.acceptedAt = new Date();
        await this.taskRepo.save(stop.task);
      }
    }
    return this.findOne(id);
  }
}
