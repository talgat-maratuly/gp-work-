import { IsNotEmpty, IsString, MaxLength, MinLength } from 'class-validator';

export class ChangeUserPasswordDto {
  @IsString()
  @IsNotEmpty()
  @MinLength(4)
  @MaxLength(128)
  password!: string;
}
