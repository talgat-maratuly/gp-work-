import { Type } from 'class-transformer';
import { IsDateString, IsEnum, IsInt, IsOptional, IsString } from 'class-validator';
import { ScheduleStatus } from '../../../common/enums/schedule-status.enum';

export class UpdateScheduleDto {
  @IsOptional()
  @IsDateString()
  plannedDate?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  objectId?: number | null;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  sectionId?: number | null;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  workTypeId?: number | null;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  brigadeId?: number | null;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  assigneeUserId?: number | null;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  taskId?: number | null;

  @IsOptional()
  @IsEnum(ScheduleStatus)
  status?: ScheduleStatus;

  @IsOptional()
  @IsString()
  rescheduleReason?: string;

  @IsOptional()
  @IsString()
  comment?: string;
}
