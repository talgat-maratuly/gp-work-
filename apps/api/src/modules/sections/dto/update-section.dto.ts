import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class UpdateSectionDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  objectId?: number;

  @IsOptional()
  @IsString()
  @Transform(({ value }) => typeof value === 'string' ? value.trim() : value)
  @IsNotEmpty()
  @MaxLength(255)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  area?: string;

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  culture?: string;

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  customText?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(-90)
  @Max(90)
  latitude?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(-180)
  @Max(180)
  longitude?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(10)
  @Max(5000)
  radiusMeters?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
