import { Type } from 'class-transformer';
import { ArrayMinSize, IsArray, IsDateString, IsInt, IsOptional, IsString, MaxLength, Min, ValidateNested } from 'class-validator';

export class CreateRouteStopDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
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
  @Min(1)
  brigadeId!: number;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CreateRouteStopDto)
  stops!: CreateRouteStopDto[];

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  comment?: string;
}
