import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { join } from 'path';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { RolesGuard } from './common/guards/roles.guard';
import { ObjectsModule } from './modules/objects/objects.module';
import { SectionsModule } from './modules/sections/sections.module';
import { WorkTypesModule } from './modules/work-types/work-types.module';
import { WorkLogsModule } from './modules/work-logs/work-logs.module';
import { UploadsModule } from './modules/uploads/uploads.module';
import { QrModule } from './modules/qr/qr.module';
import { ExportModule } from './modules/export/export.module';
import { SeedModule } from './seed/seed.module';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { BrigadesModule } from './modules/brigades/brigades.module';
import { TasksModule } from './modules/tasks/tasks.module';
import { AttendanceModule } from './modules/attendance/attendance.module';
import { ProductsModule } from './modules/products/products.module';
import { AiAgronomModule } from './modules/ai-agronom/ai-agronom.module';
import { AdminAiModule } from './modules/admin-ai/admin-ai.module';
import { FormSettingsModule } from './modules/form-settings/form-settings.module';
import { getTypeOrmPostgresFromConfig } from './database/database.config';
import {
  AiAgronomAnalysis,
  AttendanceRecord,
  Brigade,
  BrigadeMember,
  NurseryObject,
  Product,
  Section,
  SectionCodeCounter,
  StockMovement,
  Task,
  User,
  FormSetting,
  WorkLog,
  WorkType,
} from './entities';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: [
        'apps/api/.env',
        '.env',
        join(__dirname, '..', '.env'),
        join(__dirname, '..', '..', '.env'),
      ],
    }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        ...getTypeOrmPostgresFromConfig(config),
        entities: [
          NurseryObject,
          Section,
          WorkType,
          WorkLog,
          SectionCodeCounter,
          User,
          Brigade,
          BrigadeMember,
          Task,
          AttendanceRecord,
          Product,
          StockMovement,
          AiAgronomAnalysis,
          FormSetting,
        ],
        migrations: [__dirname + '/database/migrations/*{.ts,.js}'],
        migrationsRun: config.get('DB_MIGRATE') !== 'false',
      }),
    }),
    AuthModule,
    UsersModule,
    BrigadesModule,
    TasksModule,
    AttendanceModule,
    ProductsModule,
    AiAgronomModule,
    AdminAiModule,
    FormSettingsModule,
    ObjectsModule,
    SectionsModule,
    WorkTypesModule,
    WorkLogsModule,
    UploadsModule,
    QrModule,
    ExportModule,
    SeedModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
})
export class AppModule {}
