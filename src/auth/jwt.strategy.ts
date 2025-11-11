// ===============================================
// 📁 src/auth/jwt.strategy.ts
// ===============================================

import { Injectable, Logger } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';

/**
 * Interfaz del payload esperado dentro del JWT.
 */
type JwtPayload = {
  sub: number;
  email: string;
  roles?: string[];
  permissions?: string[]; // ✅ clave estándar moderna
  perms?: string[];       // 🔄 compatibilidad con versiones antiguas
  iat?: number;
  exp?: number;
};

/**
 * JwtStrategy
 * --------------------------------------------
 * Estrategia principal de Passport para validar tokens JWT.
 * Extrae el token del header Authorization: Bearer <token>,
 * valida su firma y devuelve los datos del usuario autenticado.
 */
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  private readonly logger = new Logger(JwtStrategy.name);

  constructor(private readonly config: ConfigService) {
    // === 1️⃣ Obtener clave secreta del entorno ===
    const secret = config.get<string>('JWT_SECRET') ?? 'dev-secret';
    const safePreview =
      typeof secret === 'string' && secret.length >= 4
        ? `${secret.slice(0, 2)}***${secret.slice(-2)}`
        : '(short/empty)';

    // === 2️⃣ Configurar la estrategia de extracción JWT ===
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: secret,
    });

    this.logger.debug(
      `JwtStrategy inicializada ✅ | Longitud de clave: ${
        secret?.length ?? 0
      } | Vista previa: ${safePreview}`,
    );
  }

  /**
   * ✅ Método ejecutado automáticamente al validar el JWT.
   * Retorna un objeto que será inyectado en `req.user`.
   */
  async validate(payload: JwtPayload) {
    const roles = payload.roles ?? [];
    const permissions = payload.permissions ?? payload.perms ?? [];

    this.logger.debug(
      `JWT validate ok -> sub=${payload.sub}, email=${payload.email}, roles=${roles.length}, perms=${permissions.length}`,
    );

    // Este objeto se inyecta automáticamente en `req.user`
    return {
      // Identificación
      sub: payload.sub,
      id: payload.sub,
      userId: payload.sub,

      // Identidad básica
      email: payload.email,

      // Autorización
      roles,
      permissions,
      perms: permissions, // alias compatible con código existente

      // Metadata opcional
      tokenExp: payload.exp,
      tokenIat: payload.iat,
    };
  }
}
