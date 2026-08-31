import { Type } from 'class-transformer';
import {
  IsArray,
  IsDateString,
  IsInt,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';

export class CreateAdminReportDto {
  @IsDateString()
  reportDate!: string;

  @IsOptional()
  @IsString()
  completedWorks?: string;

  @IsOptional()
  @IsString()
  pendingWorks?: string;

  @IsOptional()
  @IsString()
  tasksInProgress?: string;

  @IsOptional()
  @IsString()
  overdueTasks?: string;

  @IsOptional()
  @IsString()
  wateringDone?: string;

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
  issues?: string;

  @IsOptional()
  @IsString()
  attentionObjects?: string;

  @IsOptional()
  @IsString()
  brigadesInfo?: string;

  @IsOptional()
  @IsString()
  waterCarriersInfo?: string;

  @IsOptional()
  @IsString()
  decisions?: string;

  @IsOptional()
  @IsString()
  comment?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  photoUrls?: string[];
}
