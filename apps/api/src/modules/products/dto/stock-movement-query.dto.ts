import { Type } from 'class-transformer';
import { IsInt, IsOptional } from 'class-validator';

export class StockMovementQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  productId?: number;
}
