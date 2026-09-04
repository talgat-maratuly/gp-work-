import { Controller, Get, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '../../common/enums/user-role.enum';
import { User } from '../../entities/user.entity';
import { DashboardService } from './dashboard.service';
import { DashboardQueryDto } from './dto/dashboard-query.dto';

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
  summary(@Query() query: DashboardQueryDto, @CurrentUser() user: User) {
    return this.dashboardService.summary(query, user);
  }
}
