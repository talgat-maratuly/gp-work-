import { Type } from 'class-transformer';
import {
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

export class CreateAiAnalysisDto {
  @Type(() => Number)
  @IsInt()
  objectId!: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  sectionId?: number;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  culture?: string;

  @IsString()
  @IsNotEmpty()
  photoUrl!: string;

  @IsOptional()
  @IsString()
  agronomistComment?: string;
}
