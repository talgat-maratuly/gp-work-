import { IsNotEmpty, IsString, MaxLength, MinLength } from 'class-validator';

export class ChangeUserPasswordDto {
  @IsString()
  @IsNotEmpty()
  @MinLength(8)
  @MaxLength(128)
  password!: string;
}
