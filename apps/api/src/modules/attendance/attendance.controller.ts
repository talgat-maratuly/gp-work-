import { Body, Controller, Get, Param, ParseIntPipe, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '../../common/enums/user-role.enum';
import { User } from '../../entities/user.entity';
import { AttendanceService } from './attendance.service';
import { AttendanceQueryDto } from './dto/attendance-query.dto';
import { ClockAttendanceDto } from './dto/clock-attendance.dto';

const EMPLOYEE_ROLES = [UserRole.ADMIN, UserRole.DIRECTOR, UserRole.ACCOUNTANT, UserRole.BRIGADIER,
  UserRole.AGRONOMIST, UserRole.WORKER, UserRole.WATER_CARRIER];

@ApiTags('attendance')
@Controller('attendance')
export class AttendanceController {
  constructor(private readonly attendanceService: AttendanceService) {}

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

  @Get()
  @Roles(UserRole.ADMIN, UserRole.ACCOUNTANT, UserRole.BRIGADIER, UserRole.AGRONOMIST)
  findAll(@Query() query: AttendanceQueryDto, @CurrentUser() user: User) {
    return this.attendanceService.findAll(query, user);
  }
}
