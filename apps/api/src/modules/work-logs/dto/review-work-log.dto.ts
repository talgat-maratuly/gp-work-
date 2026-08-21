import { IsIn, IsOptional, IsString } from 'class-validator';
import { ReviewStatus } from '../../../common/enums/review-status.enum';

export class ReviewWorkLogDto {
  @IsIn([ReviewStatus.APPROVED, ReviewStatus.REJECTED])
  reviewStatus!: ReviewStatus.APPROVED | ReviewStatus.REJECTED;

  @IsOptional()
  @IsString()
  reviewComment?: string;
}
