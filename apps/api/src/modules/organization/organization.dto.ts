import { Transform, Type } from 'class-transformer';
import { IsBoolean, IsIn, IsInt, IsNotEmpty, IsOptional, IsString, Max, MaxLength, Min, ValidateIf } from 'class-validator';

const text = ({ value }: { value: unknown }) => typeof value === 'string' ? value.normalize('NFC').trim() : value;
const name = ({ value }: { value: unknown }) => typeof value === 'string' ? value.normalize('NFC').trim().replace(/\s+/g, ' ') : value;
export class UnitDto {
  @IsInt() @Min(0) @Max(2147483647) revision!: number;
  @Transform(name) @IsString() @IsNotEmpty() @MaxLength(160) name!: string;
  @IsIn(['MANAGEMENT','DEPARTMENT','FUNCTION','TERRITORY','OBJECT','TEAM']) kind!: string;
  @ValidateIf((_,v) => v !== null) @IsInt() @Min(1) @Max(2147483647) parentId!: number | null;
  @ValidateIf((_,v) => v !== null) @IsInt() @Min(1) @Max(2147483647) headUserId!: number | null;
  @ValidateIf((_,v) => v !== null) @IsInt() @Min(1) @Max(2147483647) objectId!: number | null;
  @ValidateIf((_,v) => v !== null) @IsInt() @Min(1) @Max(2147483647) brigadeId!: number | null;
  @Transform(text) @IsString() @MaxLength(3000) purpose!: string;
  @IsBoolean() isActive!: boolean;
}
export class AssignmentDto {
  @IsInt() @Min(0) @Max(2147483647) revision!: number;
  @ValidateIf((_,v) => v !== null) @IsInt() @Min(1) @Max(2147483647) unitId!: number | null;
  @ValidateIf((_,v) => v !== null) @IsInt() @Min(1) @Max(2147483647) managerId!: number | null;
  @Transform(text) @IsString() @MaxLength(3000) duties!: string;
}
export class ProcessOwnerDto {
  @IsInt() @Min(0) @Max(2147483647) revision!: number;
  @ValidateIf((_,v) => v !== null) @IsInt() @Min(1) @Max(2147483647) unitId!: number | null;
  @ValidateIf((_,v) => v !== null) @IsInt() @Min(1) @Max(2147483647) ownerUserId!: number | null;
}
export class HistoryQuery {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(2147483647) before?: number;
}
