import { Body, Controller, Get, Param, ParseIntPipe, Post, Put } from '@nestjs/common';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '../../common/enums/user-role.enum';
import { SaveAccessRoleDto } from './access-roles.dto';
import { AccessRolesService } from './access-roles.service';

@Controller('access-roles')
@Roles(UserRole.ADMIN)
export class AccessRolesController {
  constructor(private readonly service:AccessRolesService) {}
  @Get() list() { return this.service.list(); }
  @Get('catalog') catalog() { return this.service.catalog(); }
  @Post() create(@Body() dto:SaveAccessRoleDto) { return this.service.save(dto); }
  @Put(':id') update(@Param('id',ParseIntPipe) id:number,@Body() dto:SaveAccessRoleDto) { return this.service.save(dto,id); }
}
