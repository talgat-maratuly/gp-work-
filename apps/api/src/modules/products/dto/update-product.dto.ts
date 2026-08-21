import { Type } from 'class-transformer';
import {
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

export class UpdateProductDto {
  @IsOptional()
  @IsString()
  @MaxLength(255)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(128)
  code?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(128)
  article?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  unit?: string | null;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  accountingPrice?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  salePrice?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  ourPrice?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  initialQuantity?: number;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  externalId1C?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(128)
  code1C?: string | null;
}
