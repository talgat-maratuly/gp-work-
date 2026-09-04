import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

export class StartWorkDayDto {
  @IsUUID() clientSessionId!: string;
  @IsString() sectionCode!: string;
  @Type(() => Number) @IsNumber() @Min(-90) @Max(90) latitude!: number;
  @Type(() => Number) @IsNumber() @Min(-180) @Max(180) longitude!: number;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) accuracy?: number;
  @IsString() selfieUrl!: string;
  @IsArray() @ArrayMinSize(3) @ArrayMaxSize(3) @IsString({ each: true }) livenessEvidenceUrls!: string[];
  @IsString() startPhotoUrl!: string;
}

export class TaskResultDto {
  @Type(() => Number) @IsInt() taskId!: number;
  @Type(() => Number) @IsNumber() @Min(0) @Max(100) percent!: number;
  @IsOptional() @IsString() @MaxLength(200) actualVolume?: string;
  @IsOptional() @IsString() @MaxLength(1000) description?: string;
  @IsOptional() @IsString() @MaxLength(1000) incompleteReason?: string;
}

export class CloseWorkDayDto {
  @Type(() => Number) @IsInt() sessionId!: number;
  @IsString() sectionCode!: string;
  @Type(() => Number) @IsNumber() @Min(-90) @Max(90) latitude!: number;
  @Type(() => Number) @IsNumber() @Min(-180) @Max(180) longitude!: number;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) accuracy?: number;
  @IsString() selfieUrl!: string;
  @IsArray() @ArrayMinSize(3) @ArrayMaxSize(3) @IsString({ each: true }) livenessEvidenceUrls!: string[];
  @IsArray() @ArrayMinSize(1) @ArrayMaxSize(10) @IsString({ each: true }) resultPhotoUrls!: string[];
  @IsArray() @ArrayMinSize(1) @ValidateNested({ each: true }) @Type(() => TaskResultDto) results!: TaskResultDto[];
  @IsOptional() @IsString() @MaxLength(2000) summary?: string;
}

export class ReviewWorkDayDto {
  @IsBoolean() accepted!: boolean;
  @IsOptional() @IsString() comment?: string;
}
