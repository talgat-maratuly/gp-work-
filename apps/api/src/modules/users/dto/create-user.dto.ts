import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import { Type } from 'class-transformer';
import { UserRole } from '../../../common/enums/user-role.enum';

export class CreateUserDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  fullName!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(64)
  username!: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(4)
  @MaxLength(128)
  password!: string;

  @IsEnum(UserRole)
  role!: UserRole;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  brigadeId?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
