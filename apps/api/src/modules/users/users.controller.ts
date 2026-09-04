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
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '../../common/enums/user-role.enum';
import { User } from '../../entities/user.entity';
import { ChangeUserPasswordDto } from './dto/change-user-password.dto';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UsersService } from './users.service';

@ApiTags('users')
@Controller('users')
@Roles(UserRole.ADMIN)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  findAll() {
    return this.usersService.findAll().then((rows) =>
      rows.map((u) => ({
        id: u.id,
        fullName: u.fullName,
        username: u.username,
        role: u.role,
        brigadeId: u.brigadeId,
        isActive: u.isActive,
        createdAt: u.createdAt,
      })),
    );
  }

  @Get('assignees')
  @Roles(UserRole.ADMIN, UserRole.BRIGADIER, UserRole.AGRONOMIST)
  findAssignees(@CurrentUser() actor: User) {
    return this.usersService.findActiveAssignees(actor).then((rows) =>
      rows.map((u) => ({
        id: u.id,
        fullName: u.fullName,
        role: u.role,
      })),
    );
  }

  @Post()
  create(@Body() dto: CreateUserDto) {
    return this.usersService.create(dto);
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.usersService.findOnePublic(id);
  }

  @Patch(':id')
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateUserDto, @CurrentUser() actor: User) {
    return this.usersService.update(id, dto, actor);
  }

  @Patch(':id/password')
  changePassword(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ChangeUserPasswordDto,
  ) {
    return this.usersService.changePassword(id, dto.password);
  }

  @Delete(':id')
  @HttpCode(204)
  remove(@Param('id', ParseIntPipe) id: number, @CurrentUser() actor: User) {
    return this.usersService.deactivate(id, actor);
  }
}
