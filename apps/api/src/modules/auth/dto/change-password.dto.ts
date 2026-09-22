import { IsString, Matches, MaxLength, MinLength, ValidateIf } from 'class-validator';

export class ChangePasswordDto {
  @ValidateIf((_object, value) => value !== undefined)
  @IsString()
  @MaxLength(128)
  currentPassword?: string;

  @IsString()
  @MinLength(8)
  @MaxLength(72)
  @Matches(/\S/)
  newPassword!: string;
}
