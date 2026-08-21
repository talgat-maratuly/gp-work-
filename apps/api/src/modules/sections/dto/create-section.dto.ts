import { IsInt, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateSectionDto {
  @Type(() => Number)
  @IsInt()
  objectId!: number;

  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  name!: string;

  @IsOptional()
  @IsString()
  area?: string;

  @IsOptional()
  @IsString()
  culture?: string;

  @IsOptional()
  @IsString()
  customText?: string;
}
