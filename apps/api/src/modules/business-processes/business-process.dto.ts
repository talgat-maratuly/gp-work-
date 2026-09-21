import { Type } from 'class-transformer';
import { ArrayMaxSize, ArrayMinSize, ArrayUnique, IsArray, IsBoolean, IsIn, IsInt, IsObject, IsOptional, IsString, Matches, MaxLength, Min, ValidateNested } from 'class-validator';

export const PROCESS_ROLES = ['ADMIN', 'DIRECTOR', 'BRIGADIER', 'AGRONOMIST', 'WORKER', 'WATER_CARRIER'];
export const FIELD_TYPES = ['text', 'number', 'date', 'boolean', 'select'] as const;
export class BusinessFieldDto {
  @Matches(/^[a-z][a-z0-9_]{0,63}$/) id!: string;
  @IsString() @MaxLength(120) label!: string;
  @IsIn(FIELD_TYPES) type!: typeof FIELD_TYPES[number];
  @IsString() @MaxLength(300) hint!: string;
  @IsArray() @ArrayMaxSize(50) @ArrayUnique() @IsString({ each: true }) @MaxLength(120, { each: true }) options!: string[];
  @IsArray() @ArrayMinSize(1) @ArrayMaxSize(6) @ArrayUnique() @IsIn(PROCESS_ROLES, { each: true }) readRoles!: string[];
  @IsArray() @ArrayMinSize(1) @ArrayMaxSize(6) @ArrayUnique() @IsIn(PROCESS_ROLES, { each: true }) editRoles!: string[];
}
export class BusinessStageDto {
  @Matches(/^[a-z][a-z0-9_]{0,63}$/) id!: string;
  @IsString() @MaxLength(120) label!: string;
  @IsArray() @ArrayMinSize(1) @ArrayMaxSize(6) @ArrayUnique() @IsIn(PROCESS_ROLES, { each: true }) roles!: string[];
  @IsArray() @ArrayMaxSize(50) @ArrayUnique() @IsString({ each: true }) requiredFields!: string[];
  @IsArray() @ArrayMaxSize(20) @ArrayUnique() @IsString({ each: true }) nextStages!: string[];
}
export class PublishBusinessProcessDto {
  @IsOptional() @IsInt() @Min(1) processId?: number;
  @IsOptional() @IsInt() @Min(1) baseVersion?: number;
  @IsString() @MaxLength(120) title!: string;
  @IsString() @MaxLength(1000) description!: string;
  @IsString() @MaxLength(64) initialStageId!: string;
  @IsArray() @ArrayMaxSize(50) @ValidateNested({ each: true }) @Type(() => BusinessFieldDto) fields!: BusinessFieldDto[];
  @IsArray() @ArrayMinSize(2) @ArrayMaxSize(20) @ValidateNested({ each: true }) @Type(() => BusinessStageDto) stages!: BusinessStageDto[];
}
export class AttachBusinessProcessDto {
  @IsInt() @Min(1) definitionId!: number;
}
export class BusinessActionDto {
  @IsInt() @Min(1) revision!: number;
  @IsObject() values!: Record<string, unknown>;
  @IsOptional() @IsString() @MaxLength(64) toStageId?: string;
}
export class ArchiveBusinessProcessDto {
  @IsBoolean() archived!: boolean;
}
