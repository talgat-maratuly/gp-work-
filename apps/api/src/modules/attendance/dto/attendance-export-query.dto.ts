import { IsDateString, IsOptional, IsString, Matches, MaxLength } from 'class-validator';

export class AttendanceExportQueryDto {
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  @IsDateString({ strict: true })
  dateFrom!: string;

  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  @IsDateString({ strict: true })
  dateTo!: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  workerFullName?: string;
}
