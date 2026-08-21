import { IsInt, IsOptional, IsString } from 'class-validator';
import { Type } from 'class-transformer';

export class WorkLogQueryDto {
  @IsOptional()
  @IsString()
  dateFrom?: string;

  @IsOptional()
  @IsString()
  dateTo?: string;

  @IsOptional()
  @IsString()
  workerFullName?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  objectId?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  sectionId?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  workTypeId?: number;
}
