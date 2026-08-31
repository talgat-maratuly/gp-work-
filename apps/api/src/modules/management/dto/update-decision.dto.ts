import { PartialType } from '@nestjs/swagger';
import { CreateDecisionDto } from './create-decision.dto';

export class UpdateDecisionDto extends PartialType(CreateDecisionDto) {}
