// src/SistemaAdmin/auditoria/admin-only.guard.ts
import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';

/**
 * Permite el acceso únicamente a usuarios cuyo JWT incluye el rol "admin".
 *
 * El sistema usa nombres de roles en minúscula (ej. `admin`, `colaboradorproyecto`).
 * Aceptamos también `ADMIN` por compat con el enum legacy `Role.ADMIN`.
 */
@Injectable()
export class AdminOnlyGuard implements CanActivate {
  canActivate(ctx: ExecutionContext): boolean {
    const { user } = ctx.switchToHttp().getRequest();
    const roles: string[] = Array.isArray(user?.roles) ? user.roles : [];
    const isAdmin = roles.some((r) => {
      const norm = String(r ?? '').toLowerCase();
      return norm === 'admin';
    });
    if (!isAdmin) {
      throw new ForbiddenException(
        'Solo los administradores pueden acceder a la auditoría.',
      );
    }
    return true;
  }
}
