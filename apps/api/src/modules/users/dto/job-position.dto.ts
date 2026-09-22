import { Transform } from 'class-transformer';
import { IsBoolean, IsNotEmpty, IsString, MaxLength, ValidateIf } from 'class-validator';

const normalizeName = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.normalize('NFC').trim().replace(/\s+/gu, ' ') : value;

export class CreateJobPositionDto {
  @Transform(normalizeName)
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  name!: string;
}

export class UpdateJobPositionDto {
  @ValidateIf((_object, value) => value !== undefined)
  @Transform(normalizeName)
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  name?: string;

  @ValidateIf((_object, value) => value !== undefined)
  @IsBoolean()
  isActive?: boolean;
}
