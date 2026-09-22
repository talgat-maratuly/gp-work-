import { IsNumber, Max, Min } from 'class-validator';

export class ClockAttendanceDto {
  @IsNumber() @Min(-90) @Max(90) latitude!: number;
  @IsNumber() @Min(-180) @Max(180) longitude!: number;
  @IsNumber() @Min(0) accuracy!: number;
}
