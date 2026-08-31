import { Type } from 'class-transformer';
import { IsDateString, IsEnum, IsInt, IsOptional, IsString } from 'class-validator';
import { ScheduleStatus } from '../../../common/enums/schedule-status.enum';

export class CreateScheduleDto {
  @IsDateString()
  plannedDate!: string;

  @Type(() => Number)
  @IsInt()
  objectId!: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  sectionId?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  workTypeId?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  brigadeId?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  assigneeUserId?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  taskId?: number;

  @IsOptional()
  @IsEnum(ScheduleStatus)
  status?: ScheduleStatus;

  @IsOptional()
  @IsString()
  comment?: string;
}
