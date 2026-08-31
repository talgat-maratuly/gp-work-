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

export class CreateWateringDto {
  @IsDateString()
  workDate!: string;

  @IsEnum(WateringShift)
  shift!: WateringShift;

  @IsEnum(WateringType)
  type!: WateringType;

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
  waterCarrierId?: number;

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
