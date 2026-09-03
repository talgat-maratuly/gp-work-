import { Body, Controller, Get, Param, ParseIntPipe, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '../../common/enums/user-role.enum';
import { User } from '../../entities';
import {
  AddWorkPhotosDto,
  ArriveExecutionDto,
  CaptureFaceDto,
  ExecutionActionDto,
  LocationBatchDto,
  ReviewExecutionDto,
  ReviewFaceDto,
  SaveChecklistDto,
} from './dto/field-execution.dto';
import { FieldExecutionsService } from './field-executions.service';
import { WorkDaysService } from './work-days.service';
import { CloseWorkDayDto, ReviewWorkDayDto, StartWorkDayDto } from './dto/work-day.dto';

const FIELD_ROLES = [UserRole.WORKER, UserRole.BRIGADIER, UserRole.AGRONOMIST, UserRole.WATER_CARRIER] as const;

@ApiTags('field-executions')
@Controller('field')
export class FieldExecutionsController {
  constructor(private readonly service: FieldExecutionsService, private readonly workDays: WorkDaysService) {}

  @Get('scan/:sectionCode')
  @Roles(...FIELD_ROLES)
  scanState(@Param('sectionCode') code: string, @CurrentUser() user: User) { return this.workDays.state(code, user); }

  @Post('work-days/start')
  @Roles(...FIELD_ROLES)
  startDay(@Body() dto: StartWorkDayDto, @CurrentUser() user: User) { return this.workDays.start(dto, user); }

  @Post('work-days/close')
  @Roles(...FIELD_ROLES)
  closeDay(@Body() dto: CloseWorkDayDto, @CurrentUser() user: User) { return this.workDays.close(dto, user); }

  @Get('work-days')
  @Roles(UserRole.ADMIN, UserRole.DIRECTOR, UserRole.BRIGADIER, UserRole.AGRONOMIST)
  workDayList() { return this.workDays.list(); }

  @Post('work-days/:id/review')
  @Roles(UserRole.ADMIN, UserRole.DIRECTOR, UserRole.BRIGADIER, UserRole.AGRONOMIST)
  reviewDay(@Param('id', ParseIntPipe) id: number, @Body() dto: ReviewWorkDayDto, @CurrentUser() user: User) { return this.workDays.review(id, dto, user); }

  @Get('today')
  @Roles(...FIELD_ROLES)
  today(@CurrentUser() user: User) {
    return this.service.today(user);
  }

  @Get('executions/review-queue')
  @Roles(UserRole.ADMIN, UserRole.BRIGADIER, UserRole.AGRONOMIST)
  reviewQueue() {
    return this.service.reviewQueue();
  }

  @Get('executions/:id')
  @Roles(UserRole.ADMIN, ...FIELD_ROLES)
  findOne(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: User) {
    return this.service.findOneForUser(id, user);
  }

  @Post('tasks/:taskId/arrive')
  @Roles(...FIELD_ROLES)
  arrive(
    @Param('taskId', ParseIntPipe) taskId: number,
    @Body() dto: ArriveExecutionDto,
    @CurrentUser() user: User,
  ) {
    return this.service.arrive(taskId, dto, user);
  }

  @Post('executions/:id/face')
  @Roles(...FIELD_ROLES)
  captureFace(@Param('id', ParseIntPipe) id: number, @Body() dto: CaptureFaceDto, @CurrentUser() user: User) {
    return this.service.captureFace(id, dto, user);
  }

  @Post('face/:verificationId/review')
  @Roles(UserRole.ADMIN, UserRole.BRIGADIER, UserRole.AGRONOMIST)
  reviewFace(
    @Param('verificationId', ParseIntPipe) verificationId: number,
    @Body() dto: ReviewFaceDto,
    @CurrentUser() user: User,
  ) {
    return this.service.reviewFace(verificationId, dto, user);
  }

  @Post('executions/:id/photos')
  @Roles(...FIELD_ROLES)
  addPhotos(@Param('id', ParseIntPipe) id: number, @Body() dto: AddWorkPhotosDto, @CurrentUser() user: User) {
    return this.service.addPhotos(id, dto, user);
  }

  @Post('executions/:id/start')
  @Roles(...FIELD_ROLES)
  start(@Param('id', ParseIntPipe) id: number, @Body() dto: ExecutionActionDto, @CurrentUser() user: User) {
    return this.service.start(id, dto, user);
  }

  @Post('executions/:id/checklist')
  @Roles(...FIELD_ROLES)
  checklist(@Param('id', ParseIntPipe) id: number, @Body() dto: SaveChecklistDto, @CurrentUser() user: User) {
    return this.service.saveChecklist(id, dto, user);
  }

  @Post('executions/:id/complete')
  @Roles(...FIELD_ROLES)
  complete(@Param('id', ParseIntPipe) id: number, @Body() dto: ExecutionActionDto, @CurrentUser() user: User) {
    return this.service.complete(id, dto, user);
  }

  @Post('executions/:id/review')
  @Roles(UserRole.ADMIN, UserRole.BRIGADIER, UserRole.AGRONOMIST)
  review(@Param('id', ParseIntPipe) id: number, @Body() dto: ReviewExecutionDto, @CurrentUser() user: User) {
    return this.service.review(id, dto, user);
  }

  @Post('locations/batch')
  @Roles(...FIELD_ROLES)
  locations(@Body() dto: LocationBatchDto, @CurrentUser() user: User) {
    return this.service.addLocations(dto, user);
  }
}
