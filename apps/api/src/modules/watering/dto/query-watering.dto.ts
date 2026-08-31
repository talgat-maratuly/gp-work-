import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, IsString } from 'class-validator';
import {
  WateringShift,
  WateringStatus,
  WateringType,
} from '../../../common/enums/watering.enums';

export class QueryWateringDto {
  @IsOptional()
  @IsString()
  dateFrom?: string;

  @IsOptional()
  @IsString()
  dateTo?: string;

  @IsOptional()
  @IsString()
  date?: string;

  @IsOptional()
  @IsEnum(WateringShift)
  shift?: WateringShift;

  @IsOptional()
  @IsEnum(WateringType)
  type?: WateringType;

  @IsOptional()
  @IsEnum(WateringStatus)
  status?: WateringStatus;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  waterCarrierId?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  objectId?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  sectionId?: number;

  @IsOptional()
  @IsString()
  search?: string;
}
