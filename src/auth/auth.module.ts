// src/auth/auth.module.ts
import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigModule, ConfigService } from '@nestjs/config';

import { PrismaModule } from '../prisma/prisma.module';
import { CommonModule } from '../common/common.module';

import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { JwtStrategy } from './jwt.strategy';

@Module({
  imports: [
    // Variables de entorno
    ConfigModule,

    // DB y servicios comunes (EmailService, etc.)
    PrismaModule,
    CommonModule,

    // Passport con estrategia por defecto "jwt"
    PassportModule.register({
      defaultStrategy: 'jwt',
      property: 'user',
      session: false,
    }),

    // JWT configurado desde env
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (cfg: ConfigService) => ({
        secret: cfg.get<string>('JWT_SECRET') ?? 'dev-secret',
        signOptions: { expiresIn: '1d' },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    JwtStrategy, // registra la estrategia "jwt" en Passport
  ],
  exports: [
    AuthService,
    JwtModule,       // para inyectar JwtService en otros módulos (p.ej. CollaboratorsService/UsersService)
    PassportModule,  // para usar AuthGuard('jwt') fuera
  ],
})
export class AuthModule {}
