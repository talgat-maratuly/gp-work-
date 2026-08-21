import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Public } from '../../common/decorators/public.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '../../common/enums/user-role.enum';
import { WorkTypesService } from './work-types.service';
import { CreateWorkTypeDto } from './dto/create-work-type.dto';
import { UpdateWorkTypeDto } from './dto/update-work-type.dto';

@ApiTags('work-types')
@Controller('work-types')
@Roles(UserRole.ADMIN, UserRole.BRIGADIER, UserRole.AGRONOMIST)
export class WorkTypesController {
  constructor(private readonly workTypesService: WorkTypesService) {}

  @Get()
  findAll() {
    return this.workTypesService.findAll();
  }

  @Public()
  @Get('active')
  findActive() {
    return this.workTypesService.findActive();
  }

  @Post()
  @Roles(UserRole.ADMIN)
  create(@Body() dto: CreateWorkTypeDto) {
    return this.workTypesService.create(dto);
  }

  @Patch(':id')
  @Roles(UserRole.ADMIN)
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateWorkTypeDto) {
    return this.workTypesService.update(id, dto);
  }

  @Delete(':id')
  @Roles(UserRole.ADMIN)
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.workTypesService.remove(id);
  }
}
