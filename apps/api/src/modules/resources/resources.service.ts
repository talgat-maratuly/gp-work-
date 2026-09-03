import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import {
  NurseryBatchStatus,
  NurseryMovementType,
  VehicleAssignmentStatus,
  VehicleStatus,
} from '../../common/enums/resource.enums';
import {
  Brigade,
  NurseryBatch,
  NurseryMovement,
  NurseryObject,
  Route,
  Task,
  User,
  Vehicle,
  VehicleAssignment,
  WorkExecution,
} from '../../entities';
import {
  AssignVehicleDto,
  CompleteVehicleAssignmentDto,
  CreateNurseryBatchDto,
  CreateNurseryMovementDto,
  CreateVehicleDto,
  SetVehicleStatusDto,
} from './dto/resource.dto';

const quantity = (value: number | string | null | undefined) => Number(value ?? 0);
const decimal = (value: number) => value.toFixed(3);
const meter = (value: number | undefined) => (value == null ? null : value.toFixed(1));

@Injectable()
export class ResourcesService {
  constructor(
    @InjectRepository(Vehicle) private readonly vehicleRepo: Repository<Vehicle>,
    @InjectRepository(VehicleAssignment)
    private readonly assignmentRepo: Repository<VehicleAssignment>,
    @InjectRepository(NurseryBatch) private readonly batchRepo: Repository<NurseryBatch>,
    @InjectRepository(NurseryMovement)
    private readonly nurseryMovementRepo: Repository<NurseryMovement>,
    @InjectRepository(User) private readonly userRepo: Repository<User>,
    @InjectRepository(Brigade) private readonly brigadeRepo: Repository<Brigade>,
    @InjectRepository(Route) private readonly routeRepo: Repository<Route>,
    @InjectRepository(Task) private readonly taskRepo: Repository<Task>,
    @InjectRepository(WorkExecution) private readonly executionRepo: Repository<WorkExecution>,
    @InjectRepository(NurseryObject) private readonly objectRepo: Repository<NurseryObject>,
    private readonly dataSource: DataSource,
  ) {}

  private async ensureOperationalLinks(dto: {
    brigadeId?: number;
    routeId?: number;
    taskId?: number;
    executionId?: number;
    objectId?: number;
    employeeId?: number;
  }) {
    const [brigade, route, task, execution, object, employee] = await Promise.all([
      dto.brigadeId ? this.brigadeRepo.findOne({ where: { id: dto.brigadeId } }) : null,
      dto.routeId ? this.routeRepo.findOne({ where: { id: dto.routeId } }) : null,
      dto.taskId ? this.taskRepo.findOne({ where: { id: dto.taskId } }) : null,
      dto.executionId ? this.executionRepo.findOne({ where: { id: dto.executionId } }) : null,
      dto.objectId ? this.objectRepo.findOne({ where: { id: dto.objectId } }) : null,
      dto.employeeId ? this.userRepo.findOne({ where: { id: dto.employeeId } }) : null,
    ]);
    if (dto.brigadeId && !brigade) throw new NotFoundException('Бригада не найдена');
    if (dto.routeId && !route) throw new NotFoundException('Маршрут не найден');
    if (dto.taskId && !task) throw new NotFoundException('Задача не найдена');
    if (dto.executionId && !execution) throw new NotFoundException('Выполнение работы не найдено');
    if (dto.objectId && !object) throw new NotFoundException('Объект не найден');
    if (dto.employeeId && !employee) throw new NotFoundException('Сотрудник не найден');
    if (route && dto.brigadeId && route.brigadeId !== dto.brigadeId) {
      throw new BadRequestException('Маршрут назначен другой бригаде');
    }
    if (execution && dto.taskId && execution.taskId !== dto.taskId) {
      throw new BadRequestException('Выполнение относится к другой задаче');
    }
  }

  async listVehicles() {
    return this.vehicleRepo.find({
      relations: { responsibleUser: true, assignments: { brigade: true, route: true } },
      order: { isActive: 'DESC', name: 'ASC' },
    });
  }

  async createVehicle(dto: CreateVehicleDto) {
    if (dto.responsibleUserId) {
      const responsible = await this.userRepo.findOne({ where: { id: dto.responsibleUserId } });
      if (!responsible) throw new NotFoundException('Ответственный сотрудник не найден');
    }
    try {
      return await this.vehicleRepo.save(
        this.vehicleRepo.create({
          code: dto.code.trim(),
          name: dto.name.trim(),
          type: dto.type,
          registrationNumber: dto.registrationNumber?.trim() || null,
          responsibleUserId: dto.responsibleUserId ?? null,
          odometer: meter(dto.odometer),
          engineHours: meter(dto.engineHours),
          comment: dto.comment?.trim() || null,
        }),
      );
    } catch (error) {
      if ((error as { driverError?: { code?: string } }).driverError?.code === '23505') {
        throw new ConflictException('Техника с таким кодом уже существует');
      }
      throw error;
    }
  }

  async setVehicleStatus(id: number, dto: SetVehicleStatusDto) {
    const vehicle = await this.vehicleRepo.findOne({ where: { id } });
    if (!vehicle) throw new NotFoundException('Техника не найдена');
    vehicle.status = dto.status;
    if (dto.comment !== undefined) vehicle.comment = dto.comment.trim() || null;
    return this.vehicleRepo.save(vehicle);
  }

  async assignVehicle(vehicleId: number, dto: AssignVehicleDto, actor: User) {
    if (!dto.brigadeId && !dto.routeId && !dto.taskId && !dto.executionId) {
      throw new BadRequestException('Назначение необходимо привязать к бригаде, маршруту или работе');
    }
    await this.ensureOperationalLinks(dto);
    return this.dataSource.transaction(async (manager) => {
      const vehicle = await manager.findOne(Vehicle, {
        where: { id: vehicleId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!vehicle) throw new NotFoundException('Техника не найдена');
      if (!vehicle.isActive || [VehicleStatus.REPAIR, VehicleStatus.UNAVAILABLE].includes(vehicle.status)) {
        throw new BadRequestException('Техника сейчас недоступна для назначения');
      }
      const active = await manager.findOne(VehicleAssignment, {
        where: [
          { vehicleId, status: VehicleAssignmentStatus.ASSIGNED },
          { vehicleId, status: VehicleAssignmentStatus.ACTIVE },
        ],
      });
      if (active) throw new ConflictException('У техники уже есть активное назначение');

      const assignment = manager.create(VehicleAssignment, {
        vehicleId,
        brigadeId: dto.brigadeId ?? null,
        routeId: dto.routeId ?? null,
        taskId: dto.taskId ?? null,
        executionId: dto.executionId ?? null,
        status: VehicleAssignmentStatus.ASSIGNED,
        assignedById: actor.id,
        startsAt: new Date(dto.startsAt),
        endsAt: null,
        startMeter: meter(dto.startMeter),
        endMeter: null,
        comment: dto.comment?.trim() || null,
      });
      vehicle.status = VehicleStatus.ASSIGNED;
      await manager.save(vehicle);
      return manager.save(assignment);
    });
  }

  async completeAssignment(id: number, dto: CompleteVehicleAssignmentDto) {
    return this.dataSource.transaction(async (manager) => {
      const assignment = await manager.findOne(VehicleAssignment, {
        where: { id },
        lock: { mode: 'pessimistic_write' },
      });
      if (!assignment) throw new NotFoundException('Назначение техники не найдено');
      if ([VehicleAssignmentStatus.COMPLETED, VehicleAssignmentStatus.CANCELLED].includes(assignment.status)) {
        return assignment;
      }
      assignment.status = dto.status ?? VehicleAssignmentStatus.COMPLETED;
      assignment.endsAt = new Date();
      assignment.endMeter = meter(dto.endMeter);
      if (dto.comment !== undefined) assignment.comment = dto.comment.trim() || null;
      const vehicle = await manager.findOneByOrFail(Vehicle, { id: assignment.vehicleId });
      vehicle.status = VehicleStatus.FREE;
      if (dto.endMeter != null) {
        if (vehicle.type === 'CAR' || vehicle.type === 'WATER_TRUCK') vehicle.odometer = meter(dto.endMeter);
        else vehicle.engineHours = meter(dto.endMeter);
      }
      await manager.save(vehicle);
      return manager.save(assignment);
    });
  }

  async listNurseryBatches() {
    return this.batchRepo.find({ order: { culture: 'ASC', batchCode: 'ASC' } });
  }

  async createNurseryBatch(dto: CreateNurseryBatchDto, actor: User) {
    try {
      return await this.dataSource.transaction(async (manager) => {
        const batch = await manager.save(
          manager.create(NurseryBatch, {
            batchCode: dto.batchCode.trim(),
            culture: dto.culture.trim(),
            variety: dto.variety?.trim() || null,
            quantity: decimal(dto.quantity),
            reservedQuantity: '0.000',
            unit: dto.unit?.trim() || 'шт',
            size: dto.size?.trim() || null,
            ageMonths: dto.ageMonths ?? null,
            location: dto.location?.trim() || null,
            condition: dto.condition?.trim() || null,
            receivedAt: dto.receivedAt ?? null,
            comment: dto.comment?.trim() || null,
          }),
        );
        await manager.save(
          manager.create(NurseryMovement, {
            batchId: batch.id,
            type: NurseryMovementType.INCOME,
            quantity: batch.quantity,
            balanceAfter: batch.quantity,
            toLocation: batch.location,
            createdById: actor.id,
            comment: 'Создание партии',
          }),
        );
        return batch;
      });
    } catch (error) {
      if ((error as { driverError?: { code?: string } }).driverError?.code === '23505') {
        throw new ConflictException('Партия с таким кодом уже существует');
      }
      throw error;
    }
  }

  async createNurseryMovement(dto: CreateNurseryMovementDto, actor: User) {
    if (dto.clientOperationId) {
      const existing = await this.nurseryMovementRepo.findOne({
        where: { clientOperationId: dto.clientOperationId },
      });
      if (existing) return existing;
    }
    if (dto.type === NurseryMovementType.ISSUE && !dto.objectId && !dto.taskId && !dto.executionId) {
      throw new BadRequestException('Выдачу растений необходимо привязать к объекту или работе');
    }
    await this.ensureOperationalLinks(dto);
    return this.dataSource.transaction(async (manager) => {
      if (dto.clientOperationId) {
        const duplicate = await manager.findOne(NurseryMovement, {
          where: { clientOperationId: dto.clientOperationId },
        });
        if (duplicate) return duplicate;
      }
      const batch = await manager.findOne(NurseryBatch, {
        where: { id: dto.batchId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!batch) throw new NotFoundException('Партия питомника не найдена');
      let current = quantity(batch.quantity);
      let reserved = quantity(batch.reservedQuantity);
      if ([NurseryMovementType.INCOME, NurseryMovementType.RETURN].includes(dto.type)) {
        current += dto.quantity;
      } else if (dto.type === NurseryMovementType.RESERVE) {
        if (current - reserved < dto.quantity) throw new BadRequestException('Недостаточно свободных растений');
        reserved += dto.quantity;
      } else if (dto.type === NurseryMovementType.RELEASE) {
        if (reserved < dto.quantity) throw new BadRequestException('Недостаточно зарезервированных растений');
        reserved -= dto.quantity;
      } else if ([NurseryMovementType.ISSUE, NurseryMovementType.WRITE_OFF].includes(dto.type)) {
        if (current < dto.quantity) throw new BadRequestException('Недостаточно растений в партии');
        current -= dto.quantity;
        reserved = Math.min(reserved, current);
      } else if (dto.type === NurseryMovementType.CORRECTION) {
        current = dto.quantity;
        reserved = Math.min(reserved, current);
      }
      if (dto.type === NurseryMovementType.TRANSFER && dto.toLocation) batch.location = dto.toLocation.trim();
      batch.quantity = decimal(current);
      batch.reservedQuantity = decimal(reserved);
      batch.status =
        current <= 0
          ? NurseryBatchStatus.ISSUED
          : reserved >= current
            ? NurseryBatchStatus.RESERVED
            : NurseryBatchStatus.AVAILABLE;
      await manager.save(batch);
      return manager.save(
        manager.create(NurseryMovement, {
          batchId: batch.id,
          type: dto.type,
          quantity: decimal(dto.quantity),
          balanceAfter: batch.quantity,
          fromLocation: dto.fromLocation?.trim() || null,
          toLocation: dto.toLocation?.trim() || null,
          objectId: dto.objectId ?? null,
          taskId: dto.taskId ?? null,
          brigadeId: dto.brigadeId ?? null,
          employeeId: dto.employeeId ?? null,
          routeId: dto.routeId ?? null,
          executionId: dto.executionId ?? null,
          createdById: actor.id,
          clientOperationId: dto.clientOperationId ?? null,
          comment: dto.comment?.trim() || null,
        }),
      );
    });
  }

  async listNurseryMovements(batchId?: number) {
    return this.nurseryMovementRepo.find({
      where: batchId ? { batchId } : {},
      relations: {
        batch: true,
        object: true,
        task: true,
        brigade: true,
        employee: true,
        route: true,
        execution: true,
        createdBy: true,
      },
      order: { createdAt: 'DESC' },
    });
  }
}
