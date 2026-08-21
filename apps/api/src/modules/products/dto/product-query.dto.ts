import { IsOptional, IsString, MaxLength } from 'class-validator';

export class ProductQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(255)
  search?: string;
}
