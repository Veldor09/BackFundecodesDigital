// src/auth/auth.service.ts
import {
  Injectable,
  UnauthorizedException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
  // Prisma types pueden no incluir la tabla de auditoría; por eso tipamos como any cuando la usamos.
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { TokenService } from '../common/services/token.service';
import { ConfigService } from '@nestjs/config';
import { EmailService } from '../common/services/email.service';

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
    private tokens: TokenService, // lo mantenemos por compatibilidad
    private readonly config: ConfigService,
    private readonly emailService: EmailService,
  ) {}

  // ------------------------ LOGIN ------------------------
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

    if (!user) throw new UnauthorizedException('Credenciales inválidas');

    const ok = await bcrypt.compare(pass, user.password);
    if (!ok) throw new UnauthorizedException('Credenciales inválidas');

    const approved = (user as any).approved ?? false;
    if (!approved) {
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

  // ------------------------ Helpers de auditoría ------------------------
  /** Intenta registrar auditoría sin romper el flujo si la tabla no existe. */
  private async safeAuditCreate(data: {
    userId: number;
    action: 'SET_PASSWORD' | 'RESET_PASSWORD' | 'REQUEST_RESET';
    ip?: string | null;
  }) {
    try {
      // Si creas el modelo abajo, quedaría prisma.passwordAudit.create(...)
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
      // noop (tolerante)
    }
  }

  // ---------------- SET PASSWORD (token 30m de invitación) ----------------
  /**
   * Establece la contraseña definitiva a partir del token de invitación (30m).
   * En inviteUser firmas: { email, userId } con PASSWORD_JWT_SECRET.
   * Este método valida con la misma secret y tolera { id, email } por retrocompatibilidad.
   *
   * @param token JWT de invitación
   * @param newPassword contraseña nueva
   * @param confirmPassword (opcional) para validar igualdad
   * @param ip (opcional) IP origen para auditoría
   */
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

    // Soporta ambas variantes de payload
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
        verified: true, // opcional: marcar verificado al establecer contraseña
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
  /**
   * Solicita recuperación de contraseña: genera token temporal y envía email.
   * Siempre devuelve {ok:true} para no revelar si el correo existe.
   */
  async requestPasswordReset(email: string) {
    // Busca el usuario; si no existe, terminamos igual con ok:true (anti-enumeración)
    const user = await this.prisma.user.findUnique({
      where: { email },
      select: { id: true, email: true },
    });

    if (!user) {
      // Respuesta indistinguible
      return { ok: true };
    }

    const secret =
      this.config.get<string>('RESET_PASSWORD_JWT_SECRET') ||
      this.config.get<string>('PASSWORD_JWT_SECRET'); // fallback
    if (!secret) {
      throw new BadRequestException('RESET_PASSWORD_JWT_SECRET no configurado');
    }

    const expiresIn =
      this.config.get<string | number>('RESET_PASSWORD_JWT_EXPIRES') ?? '30m';

    const token = await this.jwtService.signAsync(
      { userId: user.id, email: user.email, purpose: 'reset' },
      { secret, expiresIn },
    );

    // Enviar email con link de reset
    await this.emailService.sendResetPasswordEmail(user.email, token);

    await this.safeAuditCreate({
      userId: user.id,
      action: 'REQUEST_RESET',
      ip: null,
    });

    return { ok: true };
  }

  /**
   * Cambia la contraseña usando el token de recuperación.
   * @param token JWT de reset
   * @param newPassword nueva contraseña
   * @param confirmPassword confirmación (opcional)
   * @param ip IP origen para auditoría
   */
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
      this.config.get<string>('RESET_PASSWORD_JWT_SECRET') ||
      this.config.get<string>('PASSWORD_JWT_SECRET');
    if (!secret) {
      throw new BadRequestException('RESET_PASSWORD_JWT_SECRET no configurado');
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
