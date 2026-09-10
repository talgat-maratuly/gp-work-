import { Controller, Get, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '../../common/enums/user-role.enum';
import { ReportPeriod } from './operations.metrics';
import { OperationsService } from './operations.service';

const CONTROL_ROLES = [
  UserRole.DIRECTOR,
  UserRole.ADMIN,
  UserRole.BRIGADIER,
  UserRole.AGRONOMIST,
  UserRole.AKIMAT,
  UserRole.ANTICOR,
] as const;

@ApiTags('operations')
@Controller('operations')
@Roles(...CONTROL_ROLES)
export class OperationsController {
  constructor(private readonly service: OperationsService) {}

  @Get('dispatcher')
  dispatcher(@Query('date') date?: string) {
    return this.service.dispatcher(date);
  }

  @Get('kpi')
  kpi(
    @Query('anchor') anchor?: string,
    @Query('period') period?: ReportPeriod,
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
    @Query('groupBy') groupBy?: 'employee' | 'brigade' | 'object',
  ) {
    return this.service.kpi({ anchor, period, dateFrom, dateTo, groupBy });
  }

  @Get('reports/evidence')
  report(
    @Query('anchor') anchor?: string,
    @Query('period') period?: ReportPeriod,
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
  ) {
    return this.service.report({ anchor, period, dateFrom, dateTo });
  }
}
