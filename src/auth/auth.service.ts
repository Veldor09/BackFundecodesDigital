// src/auth/auth.service.ts
import {
  Injectable,
  UnauthorizedException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { TokenService } from '../common/services/token.service';
import { ConfigService } from '@nestjs/config';
import { EmailService } from '../common/services/email.service';

const BCRYPT_COST = 12;

type UserWithRoles = {
  id: number;
  email: string;
  name: string | null;
  password: string | null;
  verified: boolean;
  approved?: boolean | null;
  roles: { role: { name: string; permissions: { key: string }[] } }[];
};

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private tokens: TokenService, // compat
    private readonly config: ConfigService,
    private readonly emailService: EmailService,
  ) {}

  // ------------------------ LOGIN (validación) ------------------------
  async validateUser(email: string, pass: string) {
    const user = await this.prisma.user.findUnique({
      where: { email },
      include: {
        roles: {
          include: {
            role: { include: { permissions: true } },
          },
        },
      },
    });

    if (!user) throw new UnauthorizedException('Credenciales inválidas');

    // ⚠️ Si no tiene password definida, no intentes comparar
    if (!user.password) {
      throw new UnauthorizedException('Usuario sin contraseña definida');
    }

    const ok = await bcrypt.compare(pass, user.password);
    if (!ok) throw new UnauthorizedException('Credenciales inválidas');

    // Estados de cuenta
    const approved = (user as any).approved ?? false;
    if (!approved) {
      throw new ForbiddenException('Cuenta no aprobada');
    }
    const verified = (user as any).verified ?? false;
    if (!verified) {
      throw new ForbiddenException('Cuenta no verificada');
    }

    return user as UserWithRoles;
  }

  // ------------------------ LOGIN (emite JWT) ------------------------
  async login(user: {
    id: number;
    email: string;
    name: string | null;
    verified: boolean;
    roles: { role: { name: string; permissions: { key: string }[] } }[];
  }) {
    // Relee desde DB para payload fresco (por si faltó algo en strategy)
    const dbUser = await this.prisma.user.findUnique({
      where: { id: user.id },
      include: {
        roles: { include: { role: { include: { permissions: true } } } },
      },
    });

    if (!dbUser) {
      throw new UnauthorizedException('Usuario no encontrado');
    }

    const roles = dbUser.roles.map((r) => r.role.name);
    const permissions = Array.from(
      new Set(dbUser.roles.flatMap((r) => r.role.permissions.map((p) => p.key))),
    );

    const payload = {
      sub: dbUser.id,
      email: dbUser.email,
      roles,
      permissions,
    };

    const access_token = await this.jwtService.signAsync(payload);

    return {
      access_token,
      user: {
        id: dbUser.id,
        email: dbUser.email,
        name: dbUser.name,
        verified: (dbUser as any).verified ?? false,
        approved: (dbUser as any).approved ?? false,
        roles,
        permissions,
        perms: permissions, // compat
      },
    };
  }

  // ------------------------ Helpers de auditoría ------------------------
  private async safeAuditCreate(data: {
    userId: number;
    action: 'SET_PASSWORD' | 'RESET_PASSWORD' | 'REQUEST_RESET';
    ip?: string | null;
  }) {
    try {
      const db: any = this.prisma as any;
      if (db.passwordAudit?.create) {
        await db.passwordAudit.create({
          data: {
            userId: data.userId,
            action: data.action,
            ip: data.ip ?? null,
          },
        });
      }
    } catch {
      // tolerante
    }
  }

  // ---------------- SET PASSWORD (token 30m de invitación) ----------------
  async setPasswordWithToken(
    token: string,
    newPassword: string,
    confirmPassword?: string,
    ip?: string | null,
  ) {
    if (!newPassword || newPassword.length < 8) {
      throw new BadRequestException(
        'La nueva contraseña es inválida (mín. 8 caracteres)',
      );
    }
    if (confirmPassword !== undefined && newPassword !== confirmPassword) {
      throw new BadRequestException('Las contraseñas no coinciden');
    }

    const secret = this.config.get<string>('PASSWORD_JWT_SECRET');
    if (!secret) {
      throw new BadRequestException('PASSWORD_JWT_SECRET no configurado');
    }

    type Payload =
      | { userId: number; email: string; jti?: string }
      | { id: number; email: string; jti?: string };

    let payload: Payload;
    try {
      payload = await this.jwtService.verifyAsync<Payload>(token, { secret });
    } catch {
      throw new BadRequestException('Token inválido o expirado');
    }

    const userId = (payload as any).userId ?? (payload as any).id;
    const email = (payload as any).email;

    if (!userId || !email) {
      throw new BadRequestException('Token inválido');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true },
    });

    if (!user || user.email !== email) {
      throw new BadRequestException('Usuario no encontrado para este token');
    }

    const password = await bcrypt.hash(newPassword, BCRYPT_COST);

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        password,
        verified: true,
      },
    });

    await this.safeAuditCreate({
      userId: user.id,
      action: 'SET_PASSWORD',
      ip: ip ?? null,
    });

    return { ok: true };
  }

  // ------------------------ RECUPERAR CONTRASEÑA ------------------------
  async requestPasswordReset(email: string) {
    const user = await this.prisma.user.findUnique({
      where: { email },
      select: { id: true, email: true },
    });

    if (!user) {
      throw new BadRequestException('El correo no está registrado');
    }

    const secret =
      this.config.get<string>('RESET_JWT_SECRET') ||
      this.config.get<string>('RESET_PASSWORD_JWT_SECRET') ||
      this.config.get<string>('PASSWORD_JWT_SECRET');
    if (!secret) {
      throw new BadRequestException('RESET_JWT_SECRET no configurado');
    }

    const expiresIn =
      this.config.get<string | number>('RESET_JWT_EXPIRES') ??
      this.config.get<string | number>('RESET_PASSWORD_JWT_EXPIRES') ??
      '30m';

    const token = await this.jwtService.signAsync(
      { userId: user.id, email: user.email, purpose: 'reset' },
      { secret, expiresIn },
    );

    await this.emailService.sendResetPasswordEmail(user.email, token);

    await this.safeAuditCreate({
      userId: user.id,
      action: 'REQUEST_RESET',
      ip: null,
    });

    return { ok: true };
  }

  // ------------------- RESET PASSWORD (con token) -------------------
  async resetPasswordWithToken(
    token: string,
    newPassword: string,
    confirmPassword?: string,
    ip?: string | null,
  ) {
    if (!newPassword || newPassword.length < 8) {
      throw new BadRequestException(
        'La nueva contraseña es inválida (mín. 8 caracteres)',
      );
    }
    if (confirmPassword !== undefined && newPassword !== confirmPassword) {
      throw new BadRequestException('Las contraseñas no coinciden');
    }

    const secret =
      this.config.get<string>('RESET_JWT_SECRET') ||
      this.config.get<string>('RESET_PASSWORD_JWT_SECRET') ||
      this.config.get<string>('PASSWORD_JWT_SECRET');
    if (!secret) {
      throw new BadRequestException('RESET_JWT_SECRET no configurado');
    }

    type ResetPayload = { userId: number; email: string; purpose?: string };
    let payload: ResetPayload;
    try {
      payload = await this.jwtService.verifyAsync<ResetPayload>(token, {
        secret,
      });
    } catch {
      throw new BadRequestException('Token inválido o expirado');
    }

    if (!payload?.userId || !payload?.email) {
      throw new BadRequestException('Token inválido');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: payload.userId },
      select: { id: true, email: true },
    });

    if (!user || user.email !== payload.email) {
      throw new BadRequestException('Usuario no encontrado para este token');
    }

    const password = await bcrypt.hash(newPassword, BCRYPT_COST);

    await this.prisma.user.update({
      where: { id: user.id },
      data: { password },
    });

    await this.safeAuditCreate({
      userId: user.id,
      action: 'RESET_PASSWORD',
      ip: ip ?? null,
    });

    return { ok: true };
  }
}
