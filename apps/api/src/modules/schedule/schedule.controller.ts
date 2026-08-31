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
import { CreateScheduleDto } from './dto/create-schedule.dto';
import { QueryScheduleDto } from './dto/query-schedule.dto';
import { UpdateScheduleDto } from './dto/update-schedule.dto';
import { ScheduleService } from './schedule.service';

// Просмотр — руководство, бригадир, агроном и контролирующие (Акимат, Антикор).
const VIEW_ROLES = [
  UserRole.DIRECTOR,
  UserRole.ADMIN,
  UserRole.BRIGADIER,
  UserRole.AGRONOMIST,
  UserRole.AKIMAT,
  UserRole.ANTICOR,
] as const;

// Планирование/редактирование — руководство, бригадир, агроном.
const EDIT_ROLES = [
  UserRole.DIRECTOR,
  UserRole.ADMIN,
  UserRole.BRIGADIER,
  UserRole.AGRONOMIST,
] as const;

@ApiTags('schedule')
@Controller('schedule')
export class ScheduleController {
  constructor(private readonly scheduleService: ScheduleService) {}

  @Get()
  @Roles(...VIEW_ROLES)
  findAll(@Query() query: QueryScheduleDto) {
    return this.scheduleService.findAll(query);
  }

  @Get(':id')
  @Roles(...VIEW_ROLES)
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.scheduleService.findOne(id);
  }

  @Post()
  @Roles(...EDIT_ROLES)
  create(@Body() dto: CreateScheduleDto, @CurrentUser() user: User) {
    return this.scheduleService.create(dto, user);
  }

  @Patch(':id')
  @Roles(...EDIT_ROLES)
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateScheduleDto,
    @CurrentUser() user: User,
  ) {
    return this.scheduleService.update(id, dto, user);
  }

  @Delete(':id')
  @HttpCode(204)
  @Roles(UserRole.DIRECTOR, UserRole.ADMIN)
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.scheduleService.remove(id);
  }
}
