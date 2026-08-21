import { ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(private readonly reflector: Reflector) {
    super();
  }

  canActivate(context: ExecutionContext) {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) {
      const request = context.switchToHttp().getRequest<{ headers: { authorization?: string } }>();
      if (!request.headers.authorization) return true;

      return Promise.resolve(super.canActivate(context))
        .then(() => true)
        .catch(() => true);
    }
    return super.canActivate(context);
  }

  handleRequest<TUser = unknown>(
    err: unknown,
    user: TUser | false | null,
    _info?: unknown,
    context?: ExecutionContext,
  ): TUser | null {
    const isPublic = context
      ? this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
          context.getHandler(),
          context.getClass(),
        ])
      : false;
    if (isPublic) {
      return err || !user ? null : user;
    }
    if (err || !user) {
      throw new UnauthorizedException('Сессия истекла. Войдите заново.');
    }
    return user;
  }
}
