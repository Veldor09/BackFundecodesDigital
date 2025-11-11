// src/auth/jwt.strategy.ts
import { Injectable, Logger } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';

type JwtPayload = {
  sub: number;
  email: string;
  roles?: string[];
  permissions?: string[]; // ✅ nuevo campo estándar
  perms?: string[];       // compat antiguo
  iat?: number;
  exp?: number;
};

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  private readonly logger = new Logger(JwtStrategy.name);

  constructor(private readonly config: ConfigService) {
    const secret = config.get<string>('JWT_SECRET') ?? 'dev-secret';
    const safePreview =
      typeof secret === 'string' && secret.length >= 4
        ? `${secret.slice(0, 2)}***${secret.slice(-2)}`
        : '(short/empty)';

    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: secret,
    });

    this.logger.debug(
      `JwtStrategy init. JWT_SECRET len=${secret?.length ?? 0} preview=${safePreview}`,
    );
  }

  async validate(payload: JwtPayload) {
    const roles = payload.roles ?? [];
    const permissions = payload.permissions ?? payload.perms ?? [];

    this.logger.debug(
      `JWT validate ok -> sub=${payload.sub}, email=${payload.email}, roles=${roles.length}, perms=${permissions.length}`,
    );

    return {
      // ids
      id: payload.sub,
      userId: payload.sub, // ✅ alias útil para otros módulos

      // identidad
      email: payload.email,

      // autorización
      roles,
      permissions, // ✅ clave estándar para PermissionsGuard
      perms: permissions, // compat con código que lea req.user.perms
    };
  }
}
