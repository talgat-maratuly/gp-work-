import { Type } from 'class-transformer';
import { ArrayMinSize, IsArray, IsBoolean, IsInt, IsNumber, IsOptional, IsString, IsUUID, Max, Min } from 'class-validator';

export class StartWorkDayDto {
  @IsUUID() clientSessionId!: string;
  @IsString() sectionCode!: string;
  @Type(() => Number) @IsNumber() @Min(-90) @Max(90) latitude!: number;
  @Type(() => Number) @IsNumber() @Min(-180) @Max(180) longitude!: number;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) accuracy?: number;
  @IsString() selfieUrl!: string;
  @IsArray() @ArrayMinSize(3) @IsString({ each: true }) livenessEvidenceUrls!: string[];
  @IsString() startPhotoUrl!: string;
}

export class TaskResultDto {
  @Type(() => Number) @IsInt() taskId!: number;
  @Type(() => Number) @IsNumber() @Min(0) @Max(100) percent!: number;
  @IsOptional() @IsString() actualVolume?: string;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsString() incompleteReason?: string;
}

export class CloseWorkDayDto extends StartWorkDayDto {
  @Type(() => Number) @IsInt() sessionId!: number;
  @IsArray() @ArrayMinSize(1) @IsString({ each: true }) resultPhotoUrls!: string[];
  @IsArray() results!: TaskResultDto[];
  @IsOptional() @IsString() summary?: string;
}

export class ReviewWorkDayDto {
  @IsBoolean() accepted!: boolean;
  @IsOptional() @IsString() comment?: string;
}
