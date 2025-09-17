// src/auth/auth.service.ts
import {
  Injectable,
  UnauthorizedException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { TokenService } from '../common/services/token.service';

const BCRYPT_COST = 12;

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
    const perms = ROLE_PERMS[r] ?? [];
    perms.forEach((p) => set.add(p));
  }
  return Array.from(set);
}

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private tokens: TokenService,
  ) {}

  async validateUser(email: string, pass: string) {
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

    const approved = (user as any).approved ?? false;

    if (approved === false) {
      throw new UnauthorizedException({
        success: false,
        statusCode: 401,
        error: 'ACCOUNT_NOT_APPROVED',
        message:
          'usted podrá iniciar sesión hasta que su cuenta haya sido aprobada',
        path: '/auth/login',
        timestamp: new Date().toISOString(),
      });
    }

    return user;
  }

  async login(user: {
    id: number;
    email: string;
    name: string | null;
    verified: boolean;

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
        verified: (user as any).verified,
        approved: (user as any).approved ?? false,
        roles,
        perms,
      },
    };
  }

  async setPasswordWithToken(token: string, newPassword: string) {
    let payload: { id: number; email: string };
    try {
      payload = this.tokens.verifySetPasswordToken(token);
    } catch {
      throw new BadRequestException('Token inválido o expirado');
    }

    const user = await this.prisma.collaborator.findUnique({
      where: { id: payload.id },
      select: { id: true, correo: true },
    });

    if (!user || user.correo !== payload.email) {
      throw new BadRequestException('Token inválido');
    }

    const passwordHash = await bcrypt.hash(newPassword, BCRYPT_COST);

    await this.prisma.collaborator.update({
      where: { id: user.id },
      data: {
        passwordHash,
        passwordUpdatedAt: new Date(),
        tempPasswordExpiresAt: null,
      },
    });

    return { ok: true };
  }
}
