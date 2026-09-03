import { Type } from 'class-transformer';
import {
  IsDateString,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
} from 'class-validator';
import {
  NurseryMovementType,
  VehicleAssignmentStatus,
  VehicleStatus,
  VehicleType,
} from '../../../common/enums/resource.enums';

export class CreateVehicleDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(64)
  code!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(160)
  name!: string;

  @IsEnum(VehicleType)
  type!: VehicleType;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  registrationNumber?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  responsibleUserId?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  odometer?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  engineHours?: number;

  @IsOptional()
  @IsString()
  comment?: string;
}

export class SetVehicleStatusDto {
  @IsEnum(VehicleStatus)
  status!: VehicleStatus;

  @IsOptional()
  @IsString()
  comment?: string;
}

export class AssignVehicleDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  brigadeId?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  routeId?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  taskId?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  executionId?: number;

  @IsDateString()
  startsAt!: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  startMeter?: number;

  @IsOptional()
  @IsString()
  comment?: string;
}

export class CompleteVehicleAssignmentDto {
  @IsOptional()
  @IsEnum(VehicleAssignmentStatus)
  status?: VehicleAssignmentStatus.COMPLETED | VehicleAssignmentStatus.CANCELLED;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  endMeter?: number;

  @IsOptional()
  @IsString()
  comment?: string;
}

export class CreateNurseryBatchDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(80)
  batchCode!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(160)
  culture!: string;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  variety?: string;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  quantity!: number;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  unit?: string;

  @IsOptional()
  @IsString()
  size?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  ageMonths?: number;

  @IsOptional()
  @IsString()
  location?: string;

  @IsOptional()
  @IsString()
  condition?: string;

  @IsOptional()
  @IsDateString()
  receivedAt?: string;

  @IsOptional()
  @IsString()
  comment?: string;
}

export class CreateNurseryMovementDto {
  @Type(() => Number)
  @IsInt()
  batchId!: number;

  @IsEnum(NurseryMovementType)
  type!: NurseryMovementType;

  @Type(() => Number)
  @IsNumber()
  @Min(0.001)
  quantity!: number;

  @IsOptional()
  @IsString()
  fromLocation?: string;

  @IsOptional()
  @IsString()
  toLocation?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  objectId?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  taskId?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  brigadeId?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  employeeId?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  routeId?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  executionId?: number;

  @IsOptional()
  @IsUUID()
  clientOperationId?: string;

  @IsOptional()
  @IsString()
  comment?: string;
}
