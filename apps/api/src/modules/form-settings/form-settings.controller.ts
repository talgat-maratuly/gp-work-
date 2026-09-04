import { Body, Controller, Get, Put } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '../../common/enums/user-role.enum';
import { UpdateFormSettingsDto } from './dto/update-form-settings.dto';
import { FormSettingsService } from './form-settings.service';

@ApiTags('form-settings')
@Controller('form-settings')
export class FormSettingsController {
  constructor(private readonly formSettingsService: FormSettingsService) {}

  @Get()
  @Roles(UserRole.ADMIN)
  getSettings() {
    return this.formSettingsService.getSettings();
  }

  @Put()
  @Roles(UserRole.ADMIN)
  updateSettings(@Body() dto: UpdateFormSettingsDto) {
    return this.formSettingsService.updateSettings(dto);
  }
}
