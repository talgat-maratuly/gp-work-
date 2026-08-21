import { Body, Controller, Get, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '../../common/enums/user-role.enum';
import { AdminAiService } from './admin-ai.service';
import { AdminAiQuestionDto } from './dto/admin-ai-question.dto';

@ApiTags('admin-ai')
@Controller('admin-ai')
@Roles(UserRole.ADMIN)
export class AdminAiController {
  constructor(private readonly adminAiService: AdminAiService) {}

  @Get('summary')
  getSummary() {
    return this.adminAiService.getSummary();
  }

  @Get('risks')
  getRisks() {
    return this.adminAiService.getRisks();
  }

  @Post('question')
  answerQuestion(@Body() dto: AdminAiQuestionDto) {
    return this.adminAiService.answerQuestion(dto);
  }
}
