import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '../../common/enums/user-role.enum';
import { User } from '../../entities/user.entity';
import { CreateDecisionDto } from './dto/create-decision.dto';
import { UpdateDecisionDto } from './dto/update-decision.dto';
import { ManagementService } from './management.service';

const VIEW_ROLES = [
  UserRole.DIRECTOR,
  UserRole.ADMIN,
  UserRole.BRIGADIER,
  UserRole.AGRONOMIST,
  UserRole.AKIMAT,
  UserRole.ANTICOR,
] as const;

// Управленческие решения ведёт руководство.
const EDIT_ROLES = [UserRole.DIRECTOR, UserRole.ADMIN] as const;

@ApiTags('management')
@Controller('management')
export class ManagementController {
  constructor(private readonly managementService: ManagementService) {}

  @Get('overview')
  @Roles(...VIEW_ROLES)
  overview(@Query('period') period?: string, @Query('date') date?: string) {
    return this.managementService.overview(period, date);
  }

  @Get('decisions')
  @Roles(...VIEW_ROLES)
  findDecisions() {
    return this.managementService.findDecisions();
  }

  @Get('decisions/:id')
  @Roles(...VIEW_ROLES)
  findDecision(@Param('id', ParseIntPipe) id: number) {
    return this.managementService.findDecision(id);
  }

  @Post('decisions')
  @Roles(...EDIT_ROLES)
  createDecision(@Body() dto: CreateDecisionDto, @CurrentUser() user: User) {
    return this.managementService.createDecision(dto, user);
  }

  @Patch('decisions/:id')
  @Roles(...EDIT_ROLES)
  updateDecision(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateDecisionDto,
    @CurrentUser() user: User,
  ) {
    return this.managementService.updateDecision(id, dto, user);
  }

  @Delete('decisions/:id')
  @HttpCode(204)
  @Roles(...EDIT_ROLES)
  removeDecision(@Param('id', ParseIntPipe) id: number) {
    return this.managementService.removeDecision(id);
  }
}
