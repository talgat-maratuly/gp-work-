import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FormSetting } from '../../entities/form-setting.entity';
import { FormSettingsController } from './form-settings.controller';
import { FormSettingsService } from './form-settings.service';

@Module({
  imports: [TypeOrmModule.forFeature([FormSetting])],
  controllers: [FormSettingsController],
  providers: [FormSettingsService],
  exports: [FormSettingsService],
})
export class FormSettingsModule {}
