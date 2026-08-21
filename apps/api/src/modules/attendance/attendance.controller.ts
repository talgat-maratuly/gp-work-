import { Body, Controller, Get, Header, Post, Query, Res } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Response } from 'express';
import * as QRCode from 'qrcode';
import { buildCheckOutUrl } from '../../common/app-url';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '../../common/enums/user-role.enum';
import { User } from '../../entities/user.entity';
import { AttendanceService } from './attendance.service';
import { AttendanceQueryDto } from './dto/attendance-query.dto';
import { CheckOutDto } from './dto/check-out.dto';

@ApiTags('attendance')
@Controller('attendance')
export class AttendanceController {
  constructor(private readonly attendanceService: AttendanceService) {}

  @Public()
  @Get('active-today')
  findActiveToday() {
    return this.attendanceService.findActiveForToday();
  }

  @Public()
  @Post('check-out')
  checkOut(@Body() dto: CheckOutDto) {
    return this.attendanceService.checkOut(dto);
  }

  @Public()
  @Get('check-out/qr.png')
  @Header('Content-Type', 'image/png')
  @Header('Content-Disposition', 'attachment; filename="qr-attendance-check-out.png"')
  async getCheckOutQr(@Res() res: Response) {
    const buffer = await QRCode.toBuffer(buildCheckOutUrl(), {
      type: 'png',
      width: 1024,
      margin: 2,
    });
    res.send(buffer);
  }

  @Get()
  @Roles(UserRole.ADMIN, UserRole.BRIGADIER, UserRole.AGRONOMIST)
  findAll(@Query() query: AttendanceQueryDto, @CurrentUser() user: User) {
    return this.attendanceService.findAll(query, user);
  }
}
