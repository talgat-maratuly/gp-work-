import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { AuthService, JwtPayload } from './auth.service';
import { getJwtSecret } from './auth.config';
import { mediaTokenFromRequest } from './media-cookie';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    config: ConfigService,
    private readonly authService: AuthService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([ExtractJwt.fromAuthHeaderAsBearerToken(), mediaTokenFromRequest]),
      ignoreExpiration: false,
      secretOrKey: getJwtSecret(config),
    });
  }

  async validate(payload: JwtPayload) {
    const user = await this.authService.findById(payload.sub);
    if (!user) return null;
    return user;
  }
}
