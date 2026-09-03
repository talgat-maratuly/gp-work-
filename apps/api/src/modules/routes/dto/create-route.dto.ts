import { Type } from 'class-transformer';
import { ArrayMinSize, IsArray, IsDateString, IsInt, IsOptional, IsString, ValidateNested } from 'class-validator';

export class CreateRouteStopDto {
  @Type(() => Number)
  @IsInt()
  taskId!: number;

  @IsOptional()
  @IsDateString()
  plannedArrivalAt?: string;
}

export class CreateRouteDto {
  @IsDateString()
  workDate!: string;

  @Type(() => Number)
  @IsInt()
  brigadeId!: number;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CreateRouteStopDto)
  stops!: CreateRouteStopDto[];

  @IsOptional()
  @IsString()
  comment?: string;
}
