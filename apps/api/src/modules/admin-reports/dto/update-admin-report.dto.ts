import { PartialType } from '@nestjs/swagger';
import { CreateAdminReportDto } from './create-admin-report.dto';

export class UpdateAdminReportDto extends PartialType(CreateAdminReportDto) {}
