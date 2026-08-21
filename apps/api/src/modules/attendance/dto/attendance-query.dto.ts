import { IsOptional, IsString, MaxLength } from 'class-validator';

export class AttendanceQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(10)
  dateFrom?: string;

  @IsOptional()
  @IsString()
  @MaxLength(10)
  dateTo?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  workerFullName?: string;
}
