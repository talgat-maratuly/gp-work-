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
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '../../common/enums/user-role.enum';
import { ObjectsService } from './objects.service';
import { CreateObjectDto } from './dto/create-object.dto';
import { UpdateObjectDto } from './dto/update-object.dto';

@ApiTags('objects')
@Controller('objects')
@Roles(UserRole.ADMIN, UserRole.BRIGADIER, UserRole.AGRONOMIST)
export class ObjectsController {
  constructor(private readonly objectsService: ObjectsService) {}

  @Get()
  findAll() {
    return this.objectsService.findAll();
  }

  @Post()
  @Roles(UserRole.ADMIN)
  create(@Body() dto: CreateObjectDto) {
    return this.objectsService.create(dto);
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.objectsService.findOne(id);
  }

  @Patch(':id')
  @Roles(UserRole.ADMIN)
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateObjectDto) {
    return this.objectsService.update(id, dto);
  }

  @Delete(':id')
  @Roles(UserRole.ADMIN)
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.objectsService.remove(id);
  }
}
