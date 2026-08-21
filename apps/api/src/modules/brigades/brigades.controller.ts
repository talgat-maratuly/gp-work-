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
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '../../common/enums/user-role.enum';
import { CreateBrigadeDto } from './dto/create-brigade.dto';
import { UpdateBrigadeDto } from './dto/update-brigade.dto';
import { BrigadesService } from './brigades.service';

@ApiTags('brigades')
@Controller('brigades')
@Roles(UserRole.ADMIN, UserRole.BRIGADIER)
export class BrigadesController {
  constructor(private readonly brigadesService: BrigadesService) {}

  @Get()
  findAll() {
    return this.brigadesService.findAll();
  }

  @Post()
  @Roles(UserRole.ADMIN)
  create(@Body() dto: CreateBrigadeDto) {
    return this.brigadesService.create(dto);
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.brigadesService.findOne(id);
  }

  @Patch(':id')
  @Roles(UserRole.ADMIN)
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateBrigadeDto) {
    return this.brigadesService.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(204)
  @Roles(UserRole.ADMIN)
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.brigadesService.remove(id);
  }
}
