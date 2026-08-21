import { ApiProperty } from '@nestjs/swagger';

export class SeedResultDto {
  @ApiProperty({ example: 'Seed completed' })
  message!: string;

  @ApiProperty({ example: 3 })
  workTypesCreated!: number;

  @ApiProperty({ example: 5 })
  workTypesSkipped!: number;

  @ApiProperty({ example: true })
  counterInitialized!: boolean;
}
