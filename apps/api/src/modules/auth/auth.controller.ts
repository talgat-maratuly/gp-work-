import { Body, Controller, Get, Headers, Post } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ApiTags } from '@nestjs/swagger';
import { Public } from '../../common/decorators/public.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { User } from '../../entities/user.entity';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post('login')
  @Throttle({ default: { limit: 5, ttl: 60_000, blockDuration: 60_000 } })
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  @Public()
  @Post('reset-admin')
  @Throttle({ default: { limit: 3, ttl: 60_000, blockDuration: 300_000 } })
  resetAdmin(@Headers('x-admin-reset-token') resetToken?: string) {
    return this.authService.resetAdmin(resetToken);
  }

  @Get('me')
  me(@CurrentUser() user: User) {
    return this.authService.toPublicUser(user);
  }
}
