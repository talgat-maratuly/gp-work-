import { IsEnum, IsIn, IsOptional, IsString } from 'class-validator';
import { AdminReportStatus } from '../../../common/enums/admin-report-status.enum';

export class ReviewAdminReportDto {
  // Проверка завершается либо подтверждением, либо возвратом на доработку.
  @IsEnum(AdminReportStatus)
  @IsIn([AdminReportStatus.APPROVED, AdminReportStatus.RETURNED])
  status!: AdminReportStatus;

  @IsOptional()
  @IsString()
  reviewComment?: string;
}
