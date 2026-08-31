import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, IsString } from 'class-validator';
import { ScheduleStatus } from '../../../common/enums/schedule-status.enum';

export class QueryScheduleDto {
  // Месяц в формате YYYY-MM — удобно для календаря.
  @IsOptional()
  @IsString()
  month?: string;

  @IsOptional()
  @IsString()
  dateFrom?: string;

  @IsOptional()
  @IsString()
  dateTo?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  objectId?: number;

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
  workTypeId?: number;

  @IsOptional()
  @IsEnum(ScheduleStatus)
  status?: ScheduleStatus;
}
