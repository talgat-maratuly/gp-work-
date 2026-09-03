import { Body, Controller, Get, Param, ParseIntPipe, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '../../common/enums/user-role.enum';
import { User } from '../../entities';
import { CreateRouteDto } from './dto/create-route.dto';
import { RoutesService } from './routes.service';

@ApiTags('routes')
@Controller('routes')
export class RoutesController {
  constructor(private readonly routesService: RoutesService) {}

  @Get()
  @Roles(UserRole.ADMIN, UserRole.BRIGADIER, UserRole.AGRONOMIST)
  findAll(@Query('date') date?: string) {
    return this.routesService.findAll(date);
  }

  @Get('my/today')
  @Roles(UserRole.WORKER, UserRole.BRIGADIER, UserRole.AGRONOMIST, UserRole.WATER_CARRIER)
  findMyToday(@CurrentUser() user: User) {
    return this.routesService.findMyToday(user);
  }

  @Get(':id')
  @Roles(UserRole.ADMIN, UserRole.BRIGADIER, UserRole.AGRONOMIST, UserRole.WORKER, UserRole.WATER_CARRIER)
  findOne(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: User) {
    return this.routesService.findOneForUser(id, user);
  }

  @Post()
  @Roles(UserRole.ADMIN, UserRole.BRIGADIER, UserRole.AGRONOMIST)
  create(@Body() dto: CreateRouteDto, @CurrentUser() user: User) {
    return this.routesService.create(dto, user);
  }

  @Post(':id/start')
  @Roles(UserRole.ADMIN, UserRole.BRIGADIER, UserRole.WORKER, UserRole.WATER_CARRIER)
  start(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: User) {
    return this.routesService.start(id, user);
  }
}
