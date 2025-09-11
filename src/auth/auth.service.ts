// src/auth/auth.service.ts
import {
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';

type RoleName = 'admin' | 'editor' | 'viewer' | string;

/** Mapa de roles -> permisos (ajústalo a tu gusto) */
const ROLE_PERMS: Record<RoleName, string[]> = {
  admin: ['users.manage', 'roles.manage', 'projects.manage', 'news.manage'],
  editor: ['news.manage', 'projects.manage'],
  viewer: [],
};

function aggregatePerms(roles: string[]): string[] {
  const set = new Set<string>();
  for (const r of roles) {
    const perms = ROLE_PERMS[r as RoleName] ?? [];
    perms.forEach((p) => set.add(p));
  }
  return Array.from(set);
}

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
  ) {}

  /** Valida credenciales y reglas de negocio (approved/verified) */
  async validateUser(email: string, pass: string) {
    // Usamos include (no select) para traer roles; los escalares vienen completos.
    const user = await this.prisma.user.findUnique({
      where: { email },
      include: {
        roles: {
          select: {
            id: true,
            userId: true,
            roleId: true,
            role: { select: { id: true, name: true } },
          },
        },
      },
    });

    if (!user) {
      throw new UnauthorizedException('Credenciales inválidas');
    }

    const ok = await bcrypt.compare(pass, user.password);
    if (!ok) {
      throw new UnauthorizedException('Credenciales inválidas');
    }

    // ⚠️ Cast puntual mientras tu cliente no ve `approved` en tipos
    const approved = (user as any).approved ?? false;

    if (approved === false) {
      throw new UnauthorizedException({
        success: false,
        statusCode: 401,
        error: 'ACCOUNT_NOT_APPROVED',
        message: 'usted podrá iniciar sesión hasta que su cuenta haya sido aprobada',
        path: '/auth/login',
        timestamp: new Date().toISOString(),
      });
    }

    // Si también quieres bloquear por verificación de email:
    // if (user.verified === false) {
    //   throw new UnauthorizedException('Tu email aún no ha sido verificado');
    // }

    return user;
  }

  /** Devuelve el JWT + user info */
  async login(user: {
    id: number;
    email: string;
    name: string | null;
    verified: boolean;
    // `approved` puede faltar en tipos viejos -> lo leemos con cast abajo
    roles: { role: { name: string } }[];
  }) {
    const roles = user.roles.map((r) => r.role.name);
    const perms = aggregatePerms(roles);

    const payload = {
      sub: user.id,
      email: user.email,
      roles,
      perms,
    };

    const access_token = await this.jwtService.signAsync(payload);

    return {
      access_token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        verified: (user as any).verified, // existe, pero mantenemos consistencia
        approved: (user as any).approved ?? false, // cast hasta regenerar tipos
        roles,
        perms,
      },
    };
  }
}
