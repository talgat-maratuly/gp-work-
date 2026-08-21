import { Type } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { StockMovementType } from '../../../common/enums/stock-movement-type.enum';

export class CreateStockMovementDto {
  @Type(() => Number)
  @IsInt()
  productId!: number;

  @IsEnum(StockMovementType)
  type!: StockMovementType;

  @Type(() => Number)
  @IsNumber()
  quantity!: number;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  workerName?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  objectId?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  sectionId?: number;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  purpose?: string;

  @IsOptional()
  @IsString()
  comment?: string;
}
