import { Transform, Type } from 'class-transformer';
import { ArrayMaxSize, ArrayMinSize, ArrayUnique, IsArray, IsBoolean, IsDateString, IsIn, IsInt, IsNotEmpty, IsNumber, IsOptional, IsString, IsUUID, Max, MaxLength, Min, ValidateNested } from 'class-validator';
const trim = ({ value }: { value: unknown }) => typeof value === 'string' ? value.trim() : value;
export class StandardDto {
  @IsInt() @Min(1) workTypeId!: number;
  @Transform(trim) @IsString() @IsNotEmpty() @MaxLength(160) title!: string;
  @IsArray() @ArrayMinSize(1) @ArrayMaxSize(30) @ArrayUnique() @IsString({ each: true }) @MaxLength(300, { each: true }) steps!: string[];
  @IsArray() @ArrayMinSize(1) @ArrayMaxSize(20) @ArrayUnique() @IsString({ each: true }) @MaxLength(300, { each: true }) preparation!: string[];
  @Transform(trim) @IsString() @IsNotEmpty() @MaxLength(2000) acceptance!: string;
}
export class MaterialDto {
  @IsInt() @Min(1) productId!: number;
  @IsNumber({ maxDecimalPlaces: 3 }) @Min(0.001) quantity!: number;
}
export class PlanDto {
  @IsInt() @Min(1) standardId!: number;
  @IsInt() @Min(1) accountableId!: number;
  @IsInt() @Min(1) reviewerId!: number;
  @IsInt() @Min(1) @Max(5) wipLimit!: number;
  @IsArray() @ArrayMaxSize(30) @ArrayUnique() @IsInt({ each: true }) @Min(1, { each: true }) toolIds!: number[];
  @IsArray() @ArrayMaxSize(30) @ValidateNested({ each: true }) @Type(() => MaterialDto) materials!: MaterialDto[];
}
export class ChecksDto {
  @IsArray() @ArrayMaxSize(30) @ArrayUnique() @IsInt({ each: true }) @Min(0, { each: true }) checked!: number[];
}
export class ObstacleDto {
  @IsIn(['WATER','MATERIAL','TOOL','ACCESS','APP','OTHER']) category!: string;
  @Transform(trim) @IsString() @IsNotEmpty() @MaxLength(2000) description!: string;
  @IsUUID() clientOperationId!: string;
}
export class ObstacleActionDto {
  @IsIn(['assign','resolve','verify','reopen']) action!: string;
  @IsOptional() @IsInt() @Min(1) ownerId?: number;
  @IsOptional() @IsDateString() dueAt?: string;
  @Transform(trim) @IsString() @IsNotEmpty() @MaxLength(2000) note!: string;
}
export class ImprovementDto {
  @IsOptional() @IsInt() @Min(1) obstacleId?: number;
  @Transform(trim) @IsString() @IsNotEmpty() @MaxLength(2000) problem!: string;
  @Transform(trim) @IsString() @IsNotEmpty() @MaxLength(2000) proposal!: string;
  @IsUUID() clientOperationId!: string;
}
export class ImprovementActionDto {
  @IsIn(['plan','measure','adopt','reject']) action!: string;
  @IsOptional() @IsInt() @Min(1) ownerId?: number;
  @IsOptional() @IsDateString() dueAt?: string;
  @IsOptional() @Transform(trim) @IsString() @MaxLength(2000) hypothesis?: string;
  @IsOptional() @Transform(trim) @IsString() @MaxLength(200) metric?: string;
  @IsOptional() @Transform(trim) @IsString() @MaxLength(40) unit?: string;
  @IsOptional() @IsIn(['LOWER','HIGHER']) direction?: 'LOWER' | 'HIGHER';
  @IsOptional() @IsNumber() baseline?: number;
  @IsOptional() @IsNumber() observed?: number;
  @Transform(trim) @IsString() @IsNotEmpty() @MaxLength(2000) note!: string;
  @IsOptional() @Transform(trim) @IsString() @MaxLength(300) adoptionRule?: string;
}
export class ToolDto {
  @Transform(trim) @IsString() @IsNotEmpty() @MaxLength(80) code!: string;
  @Transform(trim) @IsString() @IsNotEmpty() @MaxLength(160) name!: string;
  @Transform(trim) @IsString() @IsNotEmpty() @MaxLength(200) homeLocation!: string;
}
export class ToolActionDto {
  @IsIn(['inspect','issue','return','retire']) action!: string;
  @IsOptional() @IsInt() @Min(1) taskId?: number;
  @IsOptional() @IsBoolean() serviceable?: boolean;
  @IsOptional() @IsBoolean() clean?: boolean;
  @IsOptional() @Transform(trim) @IsString() @MaxLength(200) location?: string;
  @Transform(trim) @IsString() @IsNotEmpty() @MaxLength(1000) note!: string;
}
