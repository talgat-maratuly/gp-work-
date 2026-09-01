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
import { AdminReportsService } from './admin-reports.service';
import { CreateAdminReportDto } from './dto/create-admin-report.dto';
import { QueryAdminReportDto } from './dto/query-admin-report.dto';
import { ReviewAdminReportDto } from './dto/review-admin-report.dto';
import { UpdateAdminReportDto } from './dto/update-admin-report.dto';

// Просмотр — руководство и контролирующие органы (Акимат, Антикор).
const VIEW_ROLES = [
  UserRole.DIRECTOR,
  UserRole.ADMIN,
  UserRole.AKIMAT,
  UserRole.ANTICOR,
] as const;

// Создание/редактирование отчёта — администратор (и директор через наследование прав).
const EDIT_ROLES = [UserRole.DIRECTOR, UserRole.ADMIN] as const;

@ApiTags('admin-reports')
@Controller('admin-reports')
export class AdminReportsController {
  constructor(private readonly reportsService: AdminReportsService) {}

  @Get()
  @Roles(...VIEW_ROLES)
  findAll(@Query() query: QueryAdminReportDto) {
    return this.reportsService.findAll(query);
  }

  @Get('aggregate')
  @Roles(...EDIT_ROLES)
  aggregate(@Query('date') date: string) {
    return this.reportsService.aggregate(date);
  }

  @Get(':id')
  @Roles(...VIEW_ROLES)
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.reportsService.findOne(id);
  }

  @Post()
  @Roles(...EDIT_ROLES)
  create(@Body() dto: CreateAdminReportDto, @CurrentUser() user: User) {
    return this.reportsService.create(dto, user);
  }

  @Patch(':id')
  @Roles(...EDIT_ROLES)
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateAdminReportDto) {
    return this.reportsService.update(id, dto);
  }

  @Post(':id/submit')
  @Roles(...EDIT_ROLES)
  submit(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: User) {
    return this.reportsService.submit(id, user);
  }

  @Patch(':id/review')
  @Roles(UserRole.DIRECTOR)
  review(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ReviewAdminReportDto,
    @CurrentUser() user: User,
  ) {
    return this.reportsService.review(id, user, dto);
  }

  @Delete(':id')
  @HttpCode(204)
  @Roles(UserRole.DIRECTOR, UserRole.ADMIN)
  remove(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: User) {
    return this.reportsService.remove(id, user);
  }
}
