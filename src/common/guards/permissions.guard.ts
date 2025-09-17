// src/common/guards/permissions.guard.ts
import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PERMISSIONS_KEY } from '../decorators/permissions.decorator';

// Mismo mapa que en AuthService (mantener centralizado si quieres)
type RoleName = 'admin' | 'editor' | 'viewer' | string;

const ROLE_PERMS: Record<RoleName, string[]> = {
  admin: ['users.manage', 'roles.manage', 'projects.manage', 'news.manage'],
  editor: ['news.manage', 'projects.manage'],
  viewer: [],
};

function aggregatePerms(roles: string[] = []): string[] {
  const set = new Set<string>();
  for (const r of roles) {
    const perms = ROLE_PERMS[r] ?? [];
    perms.forEach((p) => set.add(p));
  }
  return Array.from(set);
}

// Lo que esperamos que venga en req.user desde el JWT
interface JwtUser {
  sub: number;
  email: string;
  roles?: string[];
  perms?: string[];
}

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(ctx: ExecutionContext): boolean {
    // Permisos requeridos por el handler/clase (@Permissions)
    const required =
      this.reflector.getAllAndOverride<string[]>(PERMISSIONS_KEY, [
        ctx.getHandler(),
        ctx.getClass(),
      ]) ?? [];

    // Si no se pidió ningún permiso, deja pasar
    if (!required.length) return true;

    const req = ctx.switchToHttp().getRequest();
    const user = (req?.user || {}) as JwtUser;

    if (!user?.sub) {
      // No debería ocurrir si JwtAuthGuard corre antes
      throw new ForbiddenException('No autenticado');
    }

    // 1) Usa perms que vienen en el JWT si existen
    // 2) Si no, derrívalos a partir de los roles del JWT
    const permsFromToken = Array.isArray(user.perms) ? user.perms : [];
    const derived = aggregatePerms(user.roles ?? []);
    const perms = new Set<string>([...permsFromToken, ...derived]);

    const ok = required.every((p) => perms.has(p));
    if (!ok) {
      throw new ForbiddenException('No tienes permisos para esta acción');
    }

    return true;
  }
}
