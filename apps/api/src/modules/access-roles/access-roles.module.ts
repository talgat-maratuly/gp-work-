import { Module } from '@nestjs/common';
import { DiscoveryModule } from '@nestjs/core';
import { AccessRolesController } from './access-roles.controller';
import { AccessRolesService } from './access-roles.service';

@Module({imports:[DiscoveryModule],controllers:[AccessRolesController],providers:[AccessRolesService]})
export class AccessRolesModule {}
