// ===============================================
// 📁 src/auth/auth.module.ts
// ===============================================

import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigModule, ConfigService } from '@nestjs/config';

import { PrismaModule } from '../prisma/prisma.module';
import { CommonModule } from '../common/common.module';

import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { JwtStrategy } from './jwt.strategy';

/**
 * AuthModule
 * --------------------------------------------
 * Módulo principal de autenticación:
 * - Maneja el login y validación de credenciales
 * - Firma/verifica tokens JWT
 * - Expone la estrategia Passport 'jwt'
 * - Exporta servicios y módulos para uso global
 */
@Module({
  imports: [
    // 🌱 Variables de entorno (JWT_SECRET, expiración, etc.)
    ConfigModule,

    // 🧩 Base de datos (Prisma) y utilidades comunes (Mailer, etc.)
    PrismaModule,
    CommonModule,

    // 🔐 Configurar Passport con la estrategia por defecto "jwt"
    PassportModule.register({
      defaultStrategy: 'jwt',
      property: 'user', // req.user
      session: false,   // JWT = sin sesiones
    }),

    // 🔑 Configurar el módulo JWT de manera asíncrona (usa ConfigService)
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (cfg: ConfigService) => ({
        secret: cfg.get<string>('JWT_SECRET') ?? 'dev-secret',
        signOptions: {
          expiresIn: cfg.get<string>('JWT_EXPIRES_IN') ?? '1d', // por defecto: 1 día
          algorithm: 'HS256',
        },
      }),
    }),
  ],

  controllers: [AuthController],

  providers: [
    AuthService,
    JwtStrategy, // 👈 registra automáticamente la estrategia 'jwt' en Passport
  ],

  exports: [
    // Permite que otros módulos usen autenticación y JWT sin reconfigurar
    AuthService,
    JwtModule,      // para inyectar JwtService en otros servicios
    PassportModule, // para usar AuthGuard('jwt') o JwtAuthGuard fuera de AuthModule
  ],
})
export class AuthModule {}
