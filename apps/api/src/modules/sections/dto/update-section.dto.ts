import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';
import { SectionLocationDto } from './section-location.dto';

export class UpdateSectionDto extends SectionLocationDto {
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
  @IsBoolean()
  isActive?: boolean;
}
