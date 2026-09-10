import { IsInt, IsNumber, Max, Min, ValidateIf } from 'class-validator';

// Omission preserves an existing location. Null, empty strings and booleans
// must not be converted into a real coordinate (notably zero).
export class SectionLocationDto {
  @ValidateIf((_object, value) => value !== undefined)
  @IsNumber()
  @Min(-90)
  @Max(90)
  latitude?: number;

  @ValidateIf((_object, value) => value !== undefined)
  @IsNumber()
  @Min(-180)
  @Max(180)
  longitude?: number;

  @ValidateIf((_object, value) => value !== undefined)
  @IsInt()
  @Min(10)
  @Max(5000)
  radiusMeters?: number;
}
