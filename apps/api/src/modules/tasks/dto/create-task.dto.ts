import { Transform, Type } from 'class-transformer';
import {
  IsDateString,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';
import { TaskCategory } from '../../../common/enums/task-category.enum';
import { TaskPriority } from '../../../common/enums/task-priority.enum';

export class CreateTaskDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  sectionId!: number;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  workTypeId!: number;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  assigneeUserId!: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  brigadeId?: number;

  @IsDateString()
  dueDate!: string;

  @IsOptional()
  @IsEnum(TaskPriority)
  priority?: TaskPriority;

  @IsString()
  @Transform(({ value }) => typeof value === 'string' ? value.trim() : value)
  @IsNotEmpty()
  @MaxLength(4000)
  description!: string;

  @IsOptional()
  @IsEnum(TaskCategory)
  category?: TaskCategory;
}
