import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, IsString } from 'class-validator';
import { AdminReportStatus } from '../../../common/enums/admin-report-status.enum';

export class QueryAdminReportDto {
  @IsOptional()
  @IsString()
  dateFrom?: string;

  @IsOptional()
  @IsString()
  dateTo?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  authorId?: number;

  @IsOptional()
  @IsEnum(AdminReportStatus)
  status?: AdminReportStatus;
}
