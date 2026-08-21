import {
  Body,
  Controller,
  Delete,
  Get,
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
import { CreateWorkLogDto } from './dto/create-work-log.dto';
import { ReviewWorkLogDto } from './dto/review-work-log.dto';
import { WorkLogQueryDto } from './dto/work-log-query.dto';
import { WorkLogsService } from './work-logs.service';

@ApiTags('work-logs')
@Controller('work-logs')
export class WorkLogsController {
  constructor(private readonly workLogsService: WorkLogsService) {}

  @Get('stats')
  @Roles(UserRole.ADMIN, UserRole.BRIGADIER, UserRole.AGRONOMIST)
  getStats() {
    return this.workLogsService.getStats();
  }

  @Get()
  @Roles(UserRole.ADMIN, UserRole.BRIGADIER, UserRole.AGRONOMIST)
  findAll(@Query() query: WorkLogQueryDto, @CurrentUser() user: User) {
    return this.workLogsService.findAll(query, user);
  }

  @Public()
  @Post()
  create(@Body() dto: CreateWorkLogDto, @CurrentUser() user?: User) {
    return this.workLogsService.create(dto, user);
  }

  @Get(':id')
  @Roles(UserRole.ADMIN, UserRole.BRIGADIER, UserRole.AGRONOMIST)
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.workLogsService.findOne(id);
  }

  @Patch(':id/review')
  @Roles(UserRole.ADMIN, UserRole.BRIGADIER, UserRole.AGRONOMIST)
  review(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ReviewWorkLogDto,
    @CurrentUser() user: User,
  ) {
    return this.workLogsService.review(id, dto, user);
  }

  @Delete(':id')
  @Roles(UserRole.ADMIN)
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.workLogsService.remove(id);
  }
}
