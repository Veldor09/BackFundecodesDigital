// src/common/guards/permissions.guard.ts
import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PERMISSIONS_KEY } from '../decorators/permissions.decorator';

// Si defines un mapa de permisos por rol, puedes mantenerlo aquí
// o centralizarlo en un servicio de Auth y reusarlo.
type RoleName = 'admin' | 'editor' | 'viewer' | string;

const ROLE_PERMS: Record<RoleName, string[]> = {
  admin: ['users.manage', 'roles.manage', 'projects.manage', 'news.manage'],
  editor: ['news.manage', 'projects.manage'],
  viewer: [],
};

function aggregatePermsFromRoles(roles: string[] = []): string[] {
  const set = new Set<string>();
  for (const r of roles) {
    const perms = ROLE_PERMS[r] ?? [];
    for (const p of perms) set.add(p);
  }
  return Array.from(set);
}

interface JwtUser {
  id?: number;        // lo populamos en JwtStrategy.validate
  sub?: number;       // por si llega sin mapear
  email?: string;
  roles?: string[];
  perms?: string[];        // nombre común que venimos usando
  permissions?: string[];  // alias alterno por compatibilidad
}

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(ctx: ExecutionContext): boolean {
    // Permisos requeridos por la ruta/controlador (@Permissions(...))
    const required =
      this.reflector.getAllAndOverride<string[]>(PERMISSIONS_KEY, [
        ctx.getHandler(),
        ctx.getClass(),
      ]) ?? [];

    // Si la ruta no exige permisos explícitos, permitir
    if (required.length === 0) return true;

    const req = ctx.switchToHttp().getRequest();
    const user: JwtUser | undefined = req?.user;

    // Si JwtAuthGuard no colocó user, devolvemos 401 (no 403)
    if (!user) {
      throw new UnauthorizedException('No autenticado');
    }

    // Normalizamos identidad
    const userId = user.id ?? user.sub;
    if (!userId) {
      // Hay user pero sin id/sub -> también es 401
      throw new UnauthorizedException('No autenticado');
    }

    // Normalizamos roles/permisos
    const roles = Array.isArray(user.roles) ? user.roles : [];

    // Bypass: rol admin siempre puede
    if (roles.includes('admin')) return true;

    const explicitPerms = Array.isArray(user.perms)
      ? user.perms
      : Array.isArray(user.permissions)
      ? user.permissions
      : [];

    // Si no vienen permisos explícitos en el token, derivamos por roles
    const derivedPerms = aggregatePermsFromRoles(roles);

    // Unimos ambos conjuntos
    const effective = new Set<string>([...explicitPerms, ...derivedPerms]);

    const hasAll = required.every((p) => effective.has(p));
    if (!hasAll) {
      throw new ForbiddenException('No tienes permisos para esta acción');
    }

    return true;
  }
}
