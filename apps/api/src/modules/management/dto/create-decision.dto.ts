import { Type } from 'class-transformer';
import {
  IsDateString,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
} from 'class-validator';
import {
  DecisionPriority,
  DecisionStatus,
} from '../../../common/enums/decision.enums';

export class CreateDecisionDto {
  @IsString()
  @IsNotEmpty()
  title!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  responsibleUserId?: number;

  @IsOptional()
  @IsDateString()
  dueDate?: string;

  @IsOptional()
  @IsEnum(DecisionPriority)
  priority?: DecisionPriority;

  @IsOptional()
  @IsEnum(DecisionStatus)
  status?: DecisionStatus;

  @IsOptional()
  @IsString()
  comment?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  linkedTaskId?: number;
}
