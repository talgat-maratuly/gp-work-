import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateObjectDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  name!: string;

  @IsOptional()
  @IsString()
  description?: string;
}
