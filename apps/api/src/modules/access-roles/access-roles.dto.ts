import { ArrayMaxSize, ArrayUnique, IsArray, IsBoolean, IsEnum, IsInt, IsNotEmpty, IsOptional, IsString, MaxLength, Min } from 'class-validator';
import { Transform } from 'class-transformer';
import { UserRole } from '../../common/enums/user-role.enum';

export class SaveAccessRoleDto {
  @IsString() @Transform(({value}) => typeof value === 'string' ? value.trim() : value)
  @IsNotEmpty() @MaxLength(100) name!: string;
  @IsEnum(UserRole) baseRole!: UserRole;
  @IsArray() @ArrayMaxSize(500) @ArrayUnique() @IsString({each:true}) permissions!: string[];
  @IsArray() @ArrayMaxSize(100) @ArrayUnique() @IsString({each:true}) pages!: string[];
  @IsBoolean() canJoinBrigade!: boolean;
  @IsBoolean() isActive!: boolean;
  @IsOptional() @IsInt() @Min(1) revision?: number;
}
