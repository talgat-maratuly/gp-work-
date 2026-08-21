import { Body, Controller, Get, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '../../common/enums/user-role.enum';
import { User } from '../../entities/user.entity';
import { AiAgronomService } from './ai-agronom.service';
import { CreateAiAnalysisDto } from './dto/create-ai-analysis.dto';

@ApiTags('ai-agronom')
@Controller('ai-agronom')
@Roles(UserRole.ADMIN, UserRole.AGRONOMIST)
export class AiAgronomController {
  constructor(private readonly aiAgronomService: AiAgronomService) {}

  @Post('analyses')
  create(@Body() dto: CreateAiAnalysisDto, @CurrentUser() user: User) {
    return this.aiAgronomService.create(dto, user);
  }

  @Get('analyses')
  findAll() {
    return this.aiAgronomService.findAll();
  }

  @Get('stats')
  getStats() {
    return this.aiAgronomService.getStats();
  }
}
