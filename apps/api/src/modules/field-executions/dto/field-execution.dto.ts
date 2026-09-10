import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { FaceVerificationStatus, WorkPhotoPhase } from '../../../common/enums/field-execution.enums';

export class GeoOperationDto {
  @IsUUID()
  clientOperationId!: string;

  @IsOptional()
  @IsDateString()
  occurredAt?: string;

  @Type(() => Number)
  @IsNumber()
  @Min(-90)
  @Max(90)
  latitude!: number;

  @Type(() => Number)
  @IsNumber()
  @Min(-180)
  @Max(180)
  longitude!: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  accuracy?: number;
}

export class ArriveExecutionDto extends GeoOperationDto {
  @IsUUID()
  clientExecutionId!: string;

  @IsString()
  @MaxLength(100)
  sectionCode!: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  routeStopId?: number;
}

export class CaptureFaceDto {
  @IsUUID()
  clientOperationId!: string;

  @IsString()
  selfieUrl!: string;

  @IsArray()
  @ArrayMinSize(3)
  @ArrayMaxSize(3)
  @IsString({ each: true })
  livenessEvidenceUrls!: string[];
}

export class ReviewFaceDto {
  @IsOptional()
  @IsUUID()
  clientOperationId?: string;

  @IsEnum(FaceVerificationStatus)
  status!: FaceVerificationStatus.VERIFIED | FaceVerificationStatus.REJECTED;

  @IsOptional()
  @IsString()
  reviewComment?: string;
}

export class AddWorkPhotoDto {
  @IsUUID()
  clientPhotoId!: string;

  @IsEnum(WorkPhotoPhase)
  phase!: WorkPhotoPhase;

  @IsString()
  url!: string;

  @IsOptional()
  @IsString()
  contentHash?: string;

  @IsDateString()
  capturedAt!: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  latitude?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  longitude?: number;
}

export class AddWorkPhotosDto {
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => AddWorkPhotoDto)
  photos!: AddWorkPhotoDto[];
}

export class ChecklistAnswerDto {
  @Type(() => Number)
  @IsInt()
  itemId!: number;

  @IsBoolean()
  isCompleted!: boolean;

  @IsOptional()
  @IsString()
  comment?: string;
}

export class SaveChecklistDto {
  @IsUUID()
  clientOperationId!: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => ChecklistAnswerDto)
  answers!: ChecklistAnswerDto[];
}

export class ExecutionActionDto {
  @IsUUID()
  clientOperationId!: string;

  @IsOptional()
  @IsDateString()
  occurredAt?: string;

  @IsOptional()
  @IsString()
  comment?: string;
}

export class CompleteExecutionDto extends ExecutionActionDto {
  @Type(() => Number)
  @IsInt()
  @Min(100)
  @Max(100)
  percent!: number;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  actualVolume?: string;

  @IsString()
  @MaxLength(1000)
  description!: string;
}

export class ReviewExecutionDto extends ExecutionActionDto {
  @IsBoolean()
  accepted!: boolean;
}

export class LocationPointDto extends GeoOperationDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  routeId?: number;
}

export class LocationBatchDto {
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => LocationPointDto)
  points!: LocationPointDto[];
}
