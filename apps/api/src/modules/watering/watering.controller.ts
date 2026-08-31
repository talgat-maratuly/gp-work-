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
import { CreateWateringDto } from './dto/create-watering.dto';
import { QueryWateringDto } from './dto/query-watering.dto';
import { ReviewWateringDto } from './dto/review-watering.dto';
import { UpdateWateringDto } from './dto/update-watering.dto';
import { WateringService } from './watering.service';

// Просмотр — все роли админ-зоны, включая контролирующие (Акимат, Антикор) и водовоза.
const VIEW_ROLES = [
  UserRole.DIRECTOR,
  UserRole.ADMIN,
  UserRole.BRIGADIER,
  UserRole.AGRONOMIST,
  UserRole.WATER_CARRIER,
  UserRole.AKIMAT,
  UserRole.ANTICOR,
] as const;

// Создание/редактирование полива — руководство, бригадир, агроном и сам водовоз.
const EDIT_ROLES = [
  UserRole.DIRECTOR,
  UserRole.ADMIN,
  UserRole.BRIGADIER,
  UserRole.AGRONOMIST,
  UserRole.WATER_CARRIER,
] as const;

// Проверка (приёмка) полива — руководство, бригадир, агроном.
const REVIEW_ROLES = [
  UserRole.DIRECTOR,
  UserRole.ADMIN,
  UserRole.BRIGADIER,
  UserRole.AGRONOMIST,
] as const;

@ApiTags('watering')
@Controller('watering')
export class WateringController {
  constructor(private readonly wateringService: WateringService) {}

  @Get()
  @Roles(...VIEW_ROLES)
  findAll(@Query() query: QueryWateringDto) {
    return this.wateringService.findAll(query);
  }

  @Get('stats')
  @Roles(...VIEW_ROLES)
  stats(@Query() query: QueryWateringDto) {
    return this.wateringService.stats(query);
  }

  @Get(':id')
  @Roles(...VIEW_ROLES)
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.wateringService.findOne(id);
  }

  @Post()
  @Roles(...EDIT_ROLES)
  create(@Body() dto: CreateWateringDto, @CurrentUser() user: User) {
    return this.wateringService.create(dto, user);
  }

  @Patch(':id/review')
  @Roles(...REVIEW_ROLES)
  review(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ReviewWateringDto,
    @CurrentUser() user: User,
  ) {
    return this.wateringService.review(id, user, dto);
  }

  @Patch(':id')
  @Roles(...EDIT_ROLES)
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateWateringDto) {
    return this.wateringService.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(204)
  @Roles(UserRole.DIRECTOR, UserRole.ADMIN)
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.wateringService.remove(id);
  }
}
