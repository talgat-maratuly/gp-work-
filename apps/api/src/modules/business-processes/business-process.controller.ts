import { Body, Controller, Get, Param, ParseIntPipe, Post, Put } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '../../common/enums/user-role.enum';
import { User } from '../../entities';
import { ArchiveBusinessProcessDto, AttachBusinessProcessDto, BusinessActionDto, PublishBusinessProcessDto } from './business-process.dto';
import { BusinessProcessService } from './business-process.service';

@ApiTags('business-processes')
@Controller('business-processes')
@Roles(UserRole.ADMIN, UserRole.BRIGADIER, UserRole.AGRONOMIST, UserRole.WORKER, UserRole.WATER_CARRIER)
export class BusinessProcessController {
  constructor(private readonly service: BusinessProcessService) {}
  @Get('definitions') @Roles(UserRole.ADMIN, UserRole.BRIGADIER, UserRole.AGRONOMIST)
  catalog(@CurrentUser() user: User) { return this.service.catalog(user); }
  @Post('definitions') @Roles(UserRole.ADMIN)
  publish(@Body() dto: PublishBusinessProcessDto, @CurrentUser() user: User) { return this.service.publish(dto, user); }
  @Put('definitions/:id/archive') @Roles(UserRole.ADMIN)
  archive(@Param('id', ParseIntPipe) id: number, @Body() dto: ArchiveBusinessProcessDto, @CurrentUser() user: User) { return this.service.archive(id, dto.archived, user); }
  @Get('tasks/:taskId')
  forTask(@Param('taskId', ParseIntPipe) taskId: number, @CurrentUser() user: User) { return this.service.forTask(taskId, user); }
  @Post('tasks/:taskId') @Roles(UserRole.ADMIN, UserRole.BRIGADIER, UserRole.AGRONOMIST)
  attach(@Param('taskId', ParseIntPipe) taskId: number, @Body() dto: AttachBusinessProcessDto, @CurrentUser() user: User) { return this.service.attach(taskId, dto.definitionId, user); }
  @Post('tasks/:taskId/:id/actions')
  action(@Param('taskId', ParseIntPipe) taskId: number, @Param('id', ParseIntPipe) id: number, @Body() dto: BusinessActionDto, @CurrentUser() user: User) { return this.service.action(taskId, id, dto, user); }
}
