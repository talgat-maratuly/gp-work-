import {
  IsArray,
  IsBoolean,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreateWorkLogDto {
  @Type(() => Number)
  @IsInt()
  sectionId!: number;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  workerFullName?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  workTypeId?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  taskId?: number;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  customWorkType?: string;

  @IsString()
  @IsNotEmpty()
  workVolume!: string;

  @IsOptional()
  @IsString()
  comment?: string;

  @IsArray()
  @IsString({ each: true })
  photoUrls!: string[];

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
  @IsBoolean()
  locationAllowed?: boolean;
}
