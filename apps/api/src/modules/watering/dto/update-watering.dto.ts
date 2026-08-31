import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';
import {
  WateringShift,
  WateringStatus,
  WateringType,
} from '../../../common/enums/watering.enums';

export class UpdateWateringDto {
  @IsOptional()
  @IsDateString()
  workDate?: string;

  @IsOptional()
  @IsEnum(WateringShift)
  shift?: WateringShift;

  @IsOptional()
  @IsEnum(WateringType)
  type?: WateringType;

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
  waterCarrierId?: number | null;

  @IsOptional()
  @IsString()
  performerName?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  plannedLiters?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  actualLiters?: number;

  @IsOptional()
  @IsString()
  startTime?: string;

  @IsOptional()
  @IsString()
  endTime?: string;

  @IsOptional()
  @IsString()
  comment?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  photoUrls?: string[];

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  latitude?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  longitude?: number;

  @IsOptional()
  @IsBoolean()
  qrConfirmed?: boolean;

  @IsOptional()
  @IsEnum(WateringStatus)
  status?: WateringStatus;
}
