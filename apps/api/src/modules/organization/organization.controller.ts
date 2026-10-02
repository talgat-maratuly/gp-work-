import { Body, Controller, Get, Param, ParseIntPipe, Post, Put, Query } from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '../../common/enums/user-role.enum';
import { User } from '../../entities';
import { AssignmentDto, HistoryQuery, ProcessOwnerDto, UnitDto } from './organization.dto';
import { OrganizationService } from './organization.service';

@Controller('organization')
@Roles(UserRole.ADMIN)
export class OrganizationController {
  constructor(private readonly service: OrganizationService) {}
  @Get() overview() { return this.service.overview(); }
  @Get('history') history(@Query() query: HistoryQuery) { return this.service.history(query.before); }
  @Post('units') createUnit(@Body() dto: UnitDto, @CurrentUser() user: User) { return this.service.saveUnit(null,dto,user.id); }
  @Put('units/:id') updateUnit(@Param('id',ParseIntPipe) id: number,@Body() dto: UnitDto,@CurrentUser() user: User) { return this.service.saveUnit(id,dto,user.id); }
  @Put('employees/:id') assignEmployee(@Param('id',ParseIntPipe) id: number,@Body() dto: AssignmentDto,@CurrentUser() user: User) { return this.service.assign(id,dto,user.id); }
  @Put('processes/:id') assignProcess(@Param('id',ParseIntPipe) id: number,@Body() dto: ProcessOwnerDto,@CurrentUser() user: User) { return this.service.assignProcess(id,dto,user.id); }
}
