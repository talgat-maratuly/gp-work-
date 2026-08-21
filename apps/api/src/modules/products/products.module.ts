import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { NurseryObject } from '../../entities/nursery-object.entity';
import { Product } from '../../entities/product.entity';
import { Section } from '../../entities/section.entity';
import { StockMovement } from '../../entities/stock-movement.entity';
import { ProductsController } from './products.controller';
import { ProductsService } from './products.service';
import { StockMovementsController } from './stock-movements.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Product, StockMovement, NurseryObject, Section])],
  controllers: [ProductsController, StockMovementsController],
  providers: [ProductsService],
  exports: [ProductsService],
})
export class ProductsModule {}
