import { IsArray, IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateFormSettingsDto {
  @IsString()
  @MaxLength(255)
  formTitle!: string;

  @IsOptional()
  @IsString()
  formDescription?: string | null;

  @IsString()
  @MaxLength(255)
  formSubmitText!: string;

  @IsString()
  @MaxLength(255)
  formSuccessText!: string;

  @IsOptional()
  @IsString()
  formHints?: string | null;

  @IsArray()
  fields!: unknown[];
}
