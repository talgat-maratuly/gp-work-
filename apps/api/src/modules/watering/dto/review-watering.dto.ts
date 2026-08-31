import { IsEnum, IsOptional, IsString } from 'class-validator';
import { WateringStatus } from '../../../common/enums/watering.enums';

export class ReviewWateringDto {
  @IsEnum(WateringStatus)
  status!: WateringStatus;

  @IsOptional()
  @IsString()
  reviewComment?: string;
}
