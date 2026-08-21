import { IsInt, IsNotEmpty, IsNumber, IsOptional, IsString, MaxLength } from 'class-validator';
import { Type } from 'class-transformer';

export class CheckOutDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  attendanceId?: number;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  workerFullName?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  latitude?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  longitude?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  locationAccuracy?: number;

  @IsOptional()
  locationAllowed?: boolean;
}
