import { Body, Controller, Get, Param, ParseIntPipe, Post, Query, StreamableFile } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '../../common/enums/user-role.enum';
import { User } from '../../entities/user.entity';
import { AttendanceService } from './attendance.service';
import { AttendanceQueryDto } from './dto/attendance-query.dto';
import { ClockAttendanceDto } from './dto/clock-attendance.dto';
import { LateExplanationDto } from './dto/late-explanation.dto';
import { AttendanceExportService } from './attendance-export.service';
import { AttendanceExportQueryDto } from './dto/attendance-export-query.dto';

const EMPLOYEE_ROLES = [UserRole.ADMIN, UserRole.DIRECTOR, UserRole.ACCOUNTANT, UserRole.BRIGADIER,
  UserRole.AGRONOMIST, UserRole.WORKER, UserRole.WATER_CARRIER];

@ApiTags('attendance')
@Controller('attendance')
export class AttendanceController {
  constructor(
    private readonly attendanceService: AttendanceService,
    private readonly attendanceExport: AttendanceExportService,
  ) {}

  @Get('export.xlsx')
  @Roles(UserRole.ADMIN)
  async exportExcel(@Query() query: AttendanceExportQueryDto, @CurrentUser() user: User) {
    return new StreamableFile(await this.attendanceExport.excel(query, user), {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      disposition: `attachment; filename="tabel_gp-work_${query.dateFrom}_${query.dateTo}.xlsx"`,
    });
  }

  @Get('export.docx')
  @Roles(UserRole.ADMIN)
  async exportWord(@Query() query: AttendanceExportQueryDto, @CurrentUser() user: User) {
    return new StreamableFile(await this.attendanceExport.word(query, user), {
      type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      disposition: `attachment; filename="tabel_gp-work_${query.dateFrom}_${query.dateTo}.docx"`,
    });
  }

  @Get('me')
  @Roles(...EMPLOYEE_ROLES)
  mine(@CurrentUser() user: User) {
    return this.attendanceService.getMyDay(user);
  }

  @Post('me/start')
  @Roles(...EMPLOYEE_ROLES)
  start(@Body() dto: ClockAttendanceDto, @CurrentUser() user: User) {
    return this.attendanceService.startMine(dto, user);
  }

  @Post('me/:id/finish')
  @Roles(...EMPLOYEE_ROLES)
  finish(@Param('id', ParseIntPipe) id: number, @Body() dto: ClockAttendanceDto, @CurrentUser() user: User) {
    return this.attendanceService.finishMine(id, dto, user);
  }

  @Post('me/:id/explanation')
  @Roles(...EMPLOYEE_ROLES)
  explanation(@Param('id', ParseIntPipe) id: number, @Body() dto: LateExplanationDto, @CurrentUser() user: User) {
    return this.attendanceService.saveMyExplanation(id, dto.explanation, user);
  }

  @Get()
  @Roles(UserRole.ADMIN, UserRole.ACCOUNTANT, UserRole.BRIGADIER, UserRole.AGRONOMIST)
  findAll(@Query() query: AttendanceQueryDto, @CurrentUser() user: User) {
    return this.attendanceService.findAll(query, user);
  }
}
