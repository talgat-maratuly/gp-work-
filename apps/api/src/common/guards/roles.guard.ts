import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { ROLES_KEY } from '../decorators/roles.decorator';
import { UserRole } from '../enums/user-role.enum';
import { User } from '../../entities/user.entity';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const requiredRoles = this.reflector.getAllAndOverride<UserRole[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!requiredRoles?.length) return true;

    const request = context.switchToHttp().getRequest<{ user?: User }>();
    const user = request.user;
    if (!user) throw new ForbiddenException('Требуется авторизация');

    // Директор имеет полный доступ наравне с администратором:
    // где разрешён ADMIN, там разрешён и DIRECTOR (без правки каждого контроллера).
    const directorInheritsAdmin =
      user.role === UserRole.DIRECTOR && requiredRoles.includes(UserRole.ADMIN);

    if (!requiredRoles.includes(user.role) && !directorInheritsAdmin) {
      throw new ForbiddenException('Недостаточно прав');
    }
    return true;
  }
}
