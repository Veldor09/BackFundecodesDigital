// src/auth/auth.module.ts
import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';

import { PrismaModule } from '../prisma/prisma.module';
import { AuthService } from './auth.service';

import * as AuthControllerMod from './auth.controller';

import { JwtStrategy } from './jwt.strategy';

@Module({
  imports: [
    PrismaModule,
    PassportModule,
    JwtModule.register({
      secret: process.env.JWT_SECRET ?? 'devsecret',
      signOptions: { expiresIn: '7d' },
    }),
  ],
  
  controllers: [AuthControllerMod.AuthController as any],


  providers: [AuthService, JwtStrategy],
  exports: [AuthService],
})
export class AuthModule {}
