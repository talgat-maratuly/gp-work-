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
import { Public } from '../../common/decorators/public.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '../../common/enums/user-role.enum';
import { SectionsService } from './sections.service';
import { CreateSectionDto } from './dto/create-section.dto';
import { UpdateSectionDto } from './dto/update-section.dto';

@ApiTags('sections')
@Controller('sections')
@Roles(UserRole.ADMIN, UserRole.BRIGADIER, UserRole.AGRONOMIST)
export class SectionsController {
  constructor(private readonly sectionsService: SectionsService) {}

  @Get()
  findAll() {
    return this.sectionsService.findAll();
  }

  @Post()
  @Roles(UserRole.ADMIN)
  create(@Body() dto: CreateSectionDto) {
    return this.sectionsService.create(dto);
  }

  @Public()
  @Get('code/:code')
  findByCode(@Param('code') code: string) {
    return this.sectionsService.findByCode(code);
  }

  @Public()
  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.sectionsService.findOne(id);
  }

  @Patch(':id')
  @Roles(UserRole.ADMIN)
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateSectionDto) {
    return this.sectionsService.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(204)
  @Roles(UserRole.ADMIN)
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.sectionsService.remove(id);
  }
}
