import { IsBoolean, IsInt, IsISO8601, IsNotEmpty, IsOptional, IsString, Matches, MaxLength, Min } from 'class-validator';
import { Transform } from 'class-transformer';
export class FocusDto {
  @IsInt() @Min(0) version!: number;
  @IsBoolean() important!: boolean;
  @IsBoolean() urgent!: boolean;
  @IsString() @Transform(({value}) => typeof value === 'string' ? value.trim() : value)
  @IsNotEmpty() @MaxLength(2000) outcome!: string;
  @IsISO8601({strict:true}) @Matches(/T.*(?:Z|[+-]\d\d:\d\d)$/) startAt!: string;
  @IsISO8601({strict:true}) @Matches(/T.*(?:Z|[+-]\d\d:\d\d)$/) endAt!: string;
  @IsOptional() @IsInt() @Min(1) improvementId?: number;
  @IsString() @MaxLength(1000) reason!: string;
}
