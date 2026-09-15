import { Body, Controller, Get, Param, ParseIntPipe, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '../../common/enums/user-role.enum';
import { User } from '../../entities';
import { WorkflowService } from './workflow.service';
import { ChecksDto, ImprovementActionDto, ImprovementDto, ObstacleActionDto, ObstacleDto, PlanDto, StandardDto, ToolActionDto, ToolDto } from './workflow.dto';
const participants = [UserRole.ADMIN,UserRole.BRIGADIER,UserRole.AGRONOMIST,UserRole.WORKER,UserRole.WATER_CARRIER];
@ApiTags('workflow')
@Controller('workflow')
@Roles(...participants)
export class WorkflowController {
  constructor(private readonly service:WorkflowService) {}
  @Get('catalog') catalog(@CurrentUser() u:User) {return this.service.catalog(u);}
  @Get('board') board(@CurrentUser() u:User) {return this.service.board(u);}
  @Get('summary') @Roles(...participants,UserRole.ACCOUNTANT) summary(@CurrentUser() u:User) {return this.service.summary(u);}
  @Get('tasks/:id') detail(@Param('id',ParseIntPipe) id:number,@CurrentUser() u:User) {return this.service.detail(id,u);}
  @Post('standards') @Roles(UserRole.ADMIN) standard(@Body() dto:StandardDto,@CurrentUser() u:User) {return this.service.saveStandard(dto,u);}
  @Post('tasks/:id/plan') @Roles(UserRole.ADMIN,UserRole.BRIGADIER,UserRole.AGRONOMIST) plan(@Param('id',ParseIntPipe) id:number,@Body() dto:PlanDto,@CurrentUser() u:User) {return this.service.configure(id,dto,u);}
  @Post('tasks/:id/prepare') prepare(@Param('id',ParseIntPipe) id:number,@Body() dto:ChecksDto,@CurrentUser() u:User) {return this.service.check(id,dto,u,'preparation');}
  @Post('tasks/:id/steps') steps(@Param('id',ParseIntPipe) id:number,@Body() dto:ChecksDto,@CurrentUser() u:User) {return this.service.check(id,dto,u,'steps');}
  @Post('tasks/:id/obstacles') obstacle(@Param('id',ParseIntPipe) id:number,@Body() dto:ObstacleDto,@CurrentUser() u:User) {return this.service.obstacle(id,dto,u);}
  @Post('obstacles/:id/actions') obstacleAction(@Param('id',ParseIntPipe) id:number,@Body() dto:ObstacleActionDto,@CurrentUser() u:User) {return this.service.obstacleAction(id,dto,u);}
  @Post('tasks/:id/improvements') improve(@Param('id',ParseIntPipe) id:number,@Body() dto:ImprovementDto,@CurrentUser() u:User) {return this.service.propose(id,dto,u);}
  @Post('improvements/:id/actions') improvementAction(@Param('id',ParseIntPipe) id:number,@Body() dto:ImprovementActionDto,@CurrentUser() u:User) {return this.service.improvementAction(id,dto,u);}
  @Get('tools') tools(@CurrentUser() u:User) {return this.service.tools(u);}
  @Post('tools') @Roles(UserRole.ADMIN) addTool(@Body() dto:ToolDto,@CurrentUser() u:User) {return this.service.addTool(dto,u);}
  @Post('tools/:id/actions') toolAction(@Param('id',ParseIntPipe) id:number,@Body() dto:ToolActionDto,@CurrentUser() u:User) {return this.service.toolAction(id,dto,u);}
}
