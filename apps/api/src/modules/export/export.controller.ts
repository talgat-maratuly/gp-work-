import { Controller, Get, Query, Res } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Response } from 'express';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '../../common/enums/user-role.enum';
import { ExportService } from './export.service';
import { WorkLogQueryDto } from '../work-logs/dto/work-log-query.dto';

@ApiTags('export')
@Controller('export')
@Roles(UserRole.ADMIN, UserRole.BRIGADIER, UserRole.AGRONOMIST)
export class ExportController {
  constructor(private readonly exportService: ExportService) {}

  @Get('work-logs.xlsx')
  async exportWorkLogs(@Query() query: WorkLogQueryDto, @Res() res: Response) {
    const buffer = await this.exportService.buildWorkLogsXlsx(query);
    const from = query.dateFrom ?? 'all';
    const to = query.dateTo ?? 'all';
    const filename = `otchet_rabot_gp-work_${from}_${to}.xlsx`;

    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(Buffer.from(buffer));
  }
}
