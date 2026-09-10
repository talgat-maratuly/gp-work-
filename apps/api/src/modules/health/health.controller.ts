import { Controller, Get } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { Public } from '../../common/decorators/public.decorator';

@Controller('health')
export class HealthController {
  constructor(private readonly dataSource: DataSource) {}

  @Public()
  @Get()
  async check() {
    try {
      await this.dataSource.query('SELECT 1');
      return { status: 'ok', database: 'ok', commit: process.env.APP_COMMIT_SHA || null, timestamp: new Date().toISOString() };
    } catch {
      return { status: 'degraded', database: 'unavailable', commit: process.env.APP_COMMIT_SHA || null, timestamp: new Date().toISOString() };
    }
  }
}
