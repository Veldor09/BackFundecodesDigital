// ===============================================
// 📁 src/auth/guards/jwt-auth.guard.ts
// ===============================================

import {
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';
import { IS_PUBLIC_KEY } from 'src/common/decorators/public.decorator';

/**
 * JwtAuthGuard
 * --------------------------------------------
 * 🔐 Protege las rutas que requieren autenticación JWT.
 * Permite acceso libre si el endpoint está marcado con @Public().
 * Caso contrario, verifica el token con la estrategia 'jwt'.
 */
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(private readonly reflector: Reflector) {
    super();
  }

  /**
   * Controla si el endpoint requiere autenticación.
   */
  canActivate(context: ExecutionContext) {
    // 🟢 1️⃣ Permitir acceso si el endpoint o el controlador tienen @Public()
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    // 🔒 2️⃣ Caso contrario, validar el token normalmente
    return super.canActivate(context);
  }

  /**
   * Maneja los errores lanzados durante la validación JWT.
   */
  handleRequest(err: any, user: any) {
    if (err || !user) {
      // Log opcional para depuración
      console.error('❌ [JwtAuthGuard] Error de autenticación:', err?.message);
      throw err || new UnauthorizedException('Token inválido o ausente.');
    }

    // 🧩 Si todo va bien, devolver el usuario decodificado del token
    return user;
  }
}
