import { Type } from 'class-transformer';
import {
  IsDateString,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
} from 'class-validator';
import { TaskCategory } from '../../../common/enums/task-category.enum';
import { TaskPriority } from '../../../common/enums/task-priority.enum';
import { TaskStatus } from '../../../common/enums/task-status.enum';

export class CreateTaskDto {
  @Type(() => Number)
  @IsInt()
  sectionId!: number;

  @Type(() => Number)
  @IsInt()
  workTypeId!: number;

  @Type(() => Number)
  @IsInt()
  assigneeUserId!: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  brigadeId?: number;

  @IsDateString()
  dueDate!: string;

  @IsOptional()
  @IsEnum(TaskPriority)
  priority?: TaskPriority;

  @IsString()
  @IsNotEmpty()
  description!: string;

  @IsOptional()
  @IsEnum(TaskStatus)
  status?: TaskStatus;

  @IsOptional()
  @IsEnum(TaskCategory)
  category?: TaskCategory;
}
