import { Body, Controller, Get, Put, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Public } from '../../common/decorators/public.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '../../common/enums/user-role.enum';
import { UpdateFormSettingsDto } from './dto/update-form-settings.dto';
import { FormSettingsService } from './form-settings.service';

@ApiTags('form-settings')
@Controller('form-settings')
export class FormSettingsController {
  constructor(private readonly formSettingsService: FormSettingsService) {}

  // form: 'work_form' (по умолчанию) | 'field_day_form'
  // Чтение открыто: настройки полей нужны и полевой форме (не содержат секретов).
  @Public()
  @Get()
  getSettings(@Query('form') form?: string) {
    return this.formSettingsService.getSettings(form);
  }

  @Put()
  @Roles(UserRole.ADMIN)
  updateSettings(@Body() dto: UpdateFormSettingsDto, @Query('form') form?: string) {
    return this.formSettingsService.updateSettings(dto, form);
  }
}
