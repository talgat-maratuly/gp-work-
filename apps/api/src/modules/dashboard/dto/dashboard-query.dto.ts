import { Type } from 'class-transformer';
import { IsEnum, IsIn, IsInt, IsOptional, Matches, Min } from 'class-validator';
import { WateringShift } from '../../../common/enums/watering.enums';

export class DashboardQueryDto {
  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'date must use YYYY-MM-DD format' })
  date?: string;

  @IsOptional()
  @IsIn(['day', 'week', 'month'])
  period?: 'day' | 'week' | 'month';

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  objectId?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  brigadeId?: number;

  @IsOptional()
  @IsEnum(WateringShift)
  shift?: WateringShift;
}
