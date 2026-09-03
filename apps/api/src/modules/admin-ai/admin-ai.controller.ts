import { Body, Controller, Get, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '../../common/enums/user-role.enum';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { User } from '../../entities/user.entity';
import { AdminAiService } from './admin-ai.service';
import { AdminAiQuestionDto } from './dto/admin-ai-question.dto';

@ApiTags('admin-ai')
@Controller('admin-ai')
export class AdminAiController {
  constructor(private readonly adminAiService: AdminAiService) {}

  @Get('summary')
  @Roles(UserRole.ADMIN, UserRole.DIRECTOR)
  getSummary() {
    return this.adminAiService.getSummary();
  }

  @Get('risks')
  @Roles(UserRole.ADMIN, UserRole.DIRECTOR)
  getRisks() {
    return this.adminAiService.getRisks();
  }

  @Post('question')
  @Roles(UserRole.ADMIN, UserRole.DIRECTOR)
  answerQuestion(@Body() dto: AdminAiQuestionDto) {
    return this.adminAiService.answerQuestion(dto);
  }

  @Get('worker/brief')
  @Roles(UserRole.WORKER, UserRole.BRIGADIER, UserRole.AGRONOMIST, UserRole.WATER_CARRIER)
  getWorkerBrief(@CurrentUser() user: User) {
    return this.adminAiService.getWorkerBrief(user);
  }

  @Post('worker/question')
  @Roles(UserRole.WORKER, UserRole.BRIGADIER, UserRole.AGRONOMIST, UserRole.WATER_CARRIER)
  answerWorkerQuestion(@Body() dto: AdminAiQuestionDto, @CurrentUser() user: User) {
    return this.adminAiService.answerWorkerQuestion(dto, user);
  }
}
