import { Controller, Get, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '../../common/enums/user-role.enum';
import { WateringShift } from '../../common/enums/watering.enums';
import { DashboardService } from './dashboard.service';

const VIEW_ROLES = [
  UserRole.DIRECTOR,
  UserRole.ADMIN,
  UserRole.BRIGADIER,
  UserRole.AGRONOMIST,
  UserRole.AKIMAT,
  UserRole.ANTICOR,
] as const;

@ApiTags('dashboard')
@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get('summary')
  @Roles(...VIEW_ROLES)
  summary(
    @Query('date') date?: string,
    @Query('period') period?: string,
    @Query('objectId') objectId?: string,
    @Query('brigadeId') brigadeId?: string,
    @Query('shift') shift?: WateringShift,
  ) {
    return this.dashboardService.summary({
      date,
      period,
      objectId: objectId ? Number(objectId) : undefined,
      brigadeId: brigadeId ? Number(brigadeId) : undefined,
      shift,
    });
  }
}
