import { ArrayMinSize, IsArray, IsIn, IsOptional, IsString } from 'class-validator';
import { TaskStatus } from '../../../common/enums/task-status.enum';

export class CompleteTaskDto {
  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  photoUrls!: string[];

  @IsOptional()
  @IsString()
  comment?: string;
}

export class ReviewTaskDto {
  @IsIn([TaskStatus.VERIFIED, TaskStatus.REJECTED])
  status!: TaskStatus.VERIFIED | TaskStatus.REJECTED;

  @IsOptional()
  @IsString()
  reviewComment?: string;
}
