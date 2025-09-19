// src/auth/jwt.strategy.ts
import { Injectable, Logger } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';

type JwtPayload = {
  sub: number;
  email: string;
  roles?: string[];
  perms?: string[];
  iat?: number;
  exp?: number;
};

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  private readonly logger = new Logger(JwtStrategy.name);

  constructor(private readonly config: ConfigService) {
    const secret = config.get<string>('JWT_SECRET') ?? 'dev-secret';
    // Log (parcial) para confirmar que está leyendo el mismo secret
    // 👇 muestra longitud y los 2 primeros/últimos chars (no el secret completo)
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
    this.logger.debug(`JWT validate ok -> sub=${payload.sub}, email=${payload.email}`);
    return {
      id: payload.sub,
      email: payload.email,
      roles: payload.roles ?? [],
      perms: payload.perms ?? [],
    };
  }
}
