import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Req, Res } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { IsObject, IsString, IsUUID, MaxLength, MinLength } from 'class-validator';
import { randomBytes } from 'crypto';
import type { Request, Response } from 'express';
import type { AuthenticationResponseJSON, RegistrationResponseJSON } from '@simplewebauthn/server';
import { Public } from '../../common/decorators/public.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { User } from '../../entities/user.entity';
import { PasskeysService } from './passkeys.service';
import { setMediaCookie } from './media-cookie';

class PasswordDto {
  @IsString() @MinLength(1) @MaxLength(256) password!: string;
}
class VerifyDto {
  @IsUUID() challengeId!: string;
  @IsObject() response!: RegistrationResponseJSON | AuthenticationResponseJSON;
}
const COOKIE = 'gp_work_passkey';
const cookieOptions = () => ({ httpOnly: true, sameSite: 'strict' as const, secure: process.env.NODE_ENV === 'production', path: '/api/auth/passkeys' });
function bind(res: Response) {
  const value = randomBytes(32).toString('hex');
  res.cookie(COOKIE, value, { ...cookieOptions(), maxAge: 300_000 });
  return value;
}
function binding(req: Request, res: Response) {
  const value = req.headers.cookie?.split(';').map(s => s.trim()).find(s => s.startsWith(`${COOKIE}=`))?.slice(COOKIE.length + 1) ?? '';
  res.clearCookie(COOKIE, cookieOptions());
  return /^[a-f0-9]{64}$/.test(value) ? value : '';
}

// Keep resource 'auth': self-service auth remains usable for restricted director policies.
@Controller('auth')
@Throttle({ default: { limit: 10, ttl: 60_000, blockDuration: 60_000 } })
export class PasskeysController {
  constructor(private readonly passkeys: PasskeysService) {}
  @Get('passkeys')
  list(@CurrentUser() user: User) { return this.passkeys.list(user); }
  @Post('passkeys/register/options')
  @Throttle({ default: { limit: 5, ttl: 60_000, blockDuration: 60_000 } })
  options(@CurrentUser() user: User, @Body() dto: PasswordDto, @Res({ passthrough: true }) res: Response) {
    return this.passkeys.registrationOptions(user, dto.password, bind(res));
  }
  @Post('passkeys/register/verify')
  register(@CurrentUser() user: User, @Body() dto: VerifyDto, @Req() req: Request, @Res({ passthrough: true }) res: Response) {
    return this.passkeys.register(user, dto.challengeId, dto.response as RegistrationResponseJSON, binding(req, res));
  }
  @Public()
  @Post('passkeys/login/options')
  loginOptions(@Res({ passthrough: true }) res: Response) { return this.passkeys.authenticationOptions(bind(res)); }
  @Public()
  @Post('passkeys/login/verify')
  async login(@Body() dto: VerifyDto, @Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const result = await this.passkeys.authenticate(dto.challengeId, dto.response as AuthenticationResponseJSON, binding(req, res));
    setMediaCookie(res, result.accessToken);
    return result;
  }
  @Post('passkeys/:id/remove')
  @Throttle({ default: { limit: 5, ttl: 60_000, blockDuration: 60_000 } })
  remove(@CurrentUser() user: User, @Param('id', ParseUUIDPipe) id: string, @Body() dto: PasswordDto) {
    return this.passkeys.remove(user, id, dto.password);
  }
}
