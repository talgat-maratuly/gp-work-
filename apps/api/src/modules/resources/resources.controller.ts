import { Body, Controller, Get, Param, ParseIntPipe, Patch, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '../../common/enums/user-role.enum';
import { User } from '../../entities';
import {
  AssignVehicleDto,
  CompleteVehicleAssignmentDto,
  CreateNurseryBatchDto,
  CreateNurseryMovementDto,
  CreateVehicleDto,
  SetVehicleStatusDto,
} from './dto/resource.dto';
import { ResourcesService } from './resources.service';

@ApiTags('resources')
@Controller('resources')
@Roles(UserRole.DIRECTOR, UserRole.ADMIN, UserRole.BRIGADIER, UserRole.AGRONOMIST)
export class ResourcesController {
  constructor(private readonly resources: ResourcesService) {}

  @Get('vehicles')
  listVehicles() {
    return this.resources.listVehicles();
  }

  @Post('vehicles')
  @Roles(UserRole.DIRECTOR, UserRole.ADMIN)
  createVehicle(@Body() dto: CreateVehicleDto) {
    return this.resources.createVehicle(dto);
  }

  @Patch('vehicles/:id/status')
  @Roles(UserRole.DIRECTOR, UserRole.ADMIN)
  setVehicleStatus(@Param('id', ParseIntPipe) id: number, @Body() dto: SetVehicleStatusDto) {
    return this.resources.setVehicleStatus(id, dto);
  }

  @Post('vehicles/:id/assignments')
  assignVehicle(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: AssignVehicleDto,
    @CurrentUser() actor: User,
  ) {
    return this.resources.assignVehicle(id, dto, actor);
  }

  @Post('vehicle-assignments/:id/complete')
  completeAssignment(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: CompleteVehicleAssignmentDto,
  ) {
    return this.resources.completeAssignment(id, dto);
  }

  @Get('nursery/batches')
  listNurseryBatches() {
    return this.resources.listNurseryBatches();
  }

  @Post('nursery/batches')
  createNurseryBatch(@Body() dto: CreateNurseryBatchDto, @CurrentUser() actor: User) {
    return this.resources.createNurseryBatch(dto, actor);
  }

  @Get('nursery/movements')
  listNurseryMovements(@Query('batchId') batchId?: string) {
    return this.resources.listNurseryMovements(batchId ? Number(batchId) : undefined);
  }

  @Post('nursery/movements')
  createNurseryMovement(@Body() dto: CreateNurseryMovementDto, @CurrentUser() actor: User) {
    return this.resources.createNurseryMovement(dto, actor);
  }
}
