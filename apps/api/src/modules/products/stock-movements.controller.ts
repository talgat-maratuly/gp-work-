import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '../../common/enums/user-role.enum';
import { User } from '../../entities/user.entity';
import { CreateStockMovementDto } from './dto/create-stock-movement.dto';
import { StockMovementQueryDto } from './dto/stock-movement-query.dto';
import { ProductsService } from './products.service';

@ApiTags('stock-movements')
@Controller('stock-movements')
@Roles(UserRole.ADMIN, UserRole.BRIGADIER)
export class StockMovementsController {
  constructor(private readonly productsService: ProductsService) {}

  @Post()
  create(@Body() dto: CreateStockMovementDto, @CurrentUser() user: User) {
    return this.productsService.createMovement(dto, user);
  }

  @Get()
  findAll(@Query() query: StockMovementQueryDto, @CurrentUser() user: User) {
    return this.productsService.findMovements(query, user);
  }
}
