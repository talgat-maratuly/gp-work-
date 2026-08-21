import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class AdminAiQuestionDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(1000)
  question!: string;
}
