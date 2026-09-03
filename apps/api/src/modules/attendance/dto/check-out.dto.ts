import {
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CheckOutDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  attendanceId?: number;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  workerFullName?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  latitude?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  longitude?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  locationAccuracy?: number;

  @IsOptional()
  locationAllowed?: boolean;

  // Процент выполненной работы (целое число 0..100).
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(100)
  completionPercent?: number;

  // Значения дополнительных полей формы ухода (comment, причина, фото и т.д.).
  @IsOptional()
  @IsObject()
  extraValues?: Record<string, unknown>;
}
