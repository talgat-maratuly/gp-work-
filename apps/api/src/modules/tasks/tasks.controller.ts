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
import { Public } from '../../common/decorators/public.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '../../common/enums/user-role.enum';
import { User } from '../../entities/user.entity';
import { CompleteTaskDto, ReviewTaskDto } from './dto/complete-task.dto';
import { CreateTaskDto } from './dto/create-task.dto';
import { UpdateTaskDto } from './dto/update-task.dto';
import { TasksService } from './tasks.service';

const EXECUTOR_ROLES = [UserRole.WORKER, UserRole.BRIGADIER, UserRole.AGRONOMIST] as const;

@ApiTags('tasks')
@Controller('tasks')
export class TasksController {
  constructor(private readonly tasksService: TasksService) {}

  @Get()
  @Roles(UserRole.ADMIN, UserRole.BRIGADIER, UserRole.AGRONOMIST)
  findAll(@CurrentUser() user: User) {
    return this.tasksService.findAllForUser(user);
  }

  @Get('my')
  @Roles(...EXECUTOR_ROLES)
  findMy(@CurrentUser() user: User) {
    return this.tasksService.findMyTasks(user);
  }

  @Get('my/:id')
  @Roles(...EXECUTOR_ROLES)
  findMyOne(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: User) {
    return this.tasksService.findMyTask(id, user);
  }

  @Post('my/:id/accept')
  @Roles(...EXECUTOR_ROLES)
  acceptMy(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: User) {
    return this.tasksService.acceptTask(id, user);
  }

  @Post('my/:id/start')
  @Roles(...EXECUTOR_ROLES)
  startMy(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: User) {
    return this.tasksService.startTask(id, user);
  }

  @Post('my/:id/complete')
  @Roles(...EXECUTOR_ROLES)
  completeMy(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: CompleteTaskDto,
    @CurrentUser() user: User,
  ) {
    return this.tasksService.completeTask(id, user, dto);
  }

  @Public()
  @Get('open')
  findOpen(@Query('sectionId', ParseIntPipe) sectionId: number) {
    return this.tasksService.findOpenForSection(sectionId);
  }

  @Post()
  @Roles(UserRole.ADMIN, UserRole.BRIGADIER, UserRole.AGRONOMIST)
  create(@Body() dto: CreateTaskDto, @CurrentUser() user: User) {
    return this.tasksService.create(dto, user);
  }

  @Get(':id')
  @Roles(UserRole.ADMIN, UserRole.BRIGADIER, UserRole.AGRONOMIST)
  findOne(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: User) {
    return this.tasksService.findOneForUser(id, user);
  }

  @Patch(':id/review')
  @Roles(UserRole.ADMIN, UserRole.AGRONOMIST)
  review(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ReviewTaskDto,
    @CurrentUser() user: User,
  ) {
    return this.tasksService.reviewTask(id, user, dto);
  }

  @Patch(':id')
  @Roles(UserRole.ADMIN, UserRole.BRIGADIER, UserRole.AGRONOMIST)
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateTaskDto) {
    return this.tasksService.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(204)
  @Roles(UserRole.ADMIN, UserRole.BRIGADIER, UserRole.AGRONOMIST)
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.tasksService.remove(id);
  }
}
