import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class CreateWorkTypeDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  name!: string;
}
