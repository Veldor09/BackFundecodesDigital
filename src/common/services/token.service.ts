// src/common/services/token.service.ts
import { Injectable } from '@nestjs/common';
import jwt, { SignOptions, Secret, JwtPayload } from 'jsonwebtoken';

function parseExpiresIn(v: string | undefined): SignOptions['expiresIn'] {
  if (!v) return '30m';
  // formatos válidos típicos para jsonwebtoken: 60, "2 days", "10h", "7d", "30m", etc.
  // Para evitar conflictos de tipos, aceptamos números o strings tipo "30m"
  // Si es número puro -> convertir a number
  const asNumber = Number(v);
  if (!Number.isNaN(asNumber) && v.trim() !== '') return asNumber;

  // Validar formato corto (opcional; puedes relajar si usas "2 days")
  const shortFmt = /^\d+(ms|s|m|h|d|w|y)$/i;
  if (shortFmt.test(v)) return v as unknown as SignOptions['expiresIn'];

  // Como fallback, castear (jsonwebtoken lo soporta, el error era solo de TS)
  return v as unknown as SignOptions['expiresIn'];
}

@Injectable()
export class TokenService {
  private readonly secret: Secret = (process.env.PASSWORD_JWT_SECRET ||
    'changeme') as Secret;
  private readonly expiresIn: SignOptions['expiresIn'] = parseExpiresIn(
    process.env.PASSWORD_JWT_EXPIRES,
  );

  /** Genera un JWT para setear contraseña (expira en 30m por defecto) */
  generateSetPasswordToken(payload: { id: number; email: string }): string {
    const options: SignOptions = { expiresIn: this.expiresIn };
    return jwt.sign(payload, this.secret, options);
  }

  /** Verifica y devuelve { id, email } del token */
  verifySetPasswordToken(token: string): { id: number; email: string } {
    const decoded = jwt.verify(token, this.secret);
    if (typeof decoded === 'string') {
      throw new Error('Invalid token payload');
    }
    const { id, email } = decoded as any;
    return { id, email };
  }
}
