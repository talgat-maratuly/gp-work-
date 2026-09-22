import { Body, Controller, Get, Param, ParseIntPipe, Patch, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '../../common/enums/user-role.enum';
import { CreateJobPositionDto, UpdateJobPositionDto } from './dto/job-position.dto';
import { JobPositionsService } from './job-positions.service';

@ApiTags('job-positions')
@Controller('job-positions')
@Roles(UserRole.ADMIN, UserRole.DIRECTOR)
export class JobPositionsController {
  constructor(private readonly positions: JobPositionsService) {}

  @Get()
  findAll() { return this.positions.findAll(); }

  @Post()
  create(@Body() dto: CreateJobPositionDto) { return this.positions.create(dto); }

  @Patch(':id')
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateJobPositionDto) {
    return this.positions.update(id, dto);
  }
}
