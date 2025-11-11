// src/auth/auth.controller.ts
import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiBody,
  ApiOkResponse,
  ApiUnauthorizedResponse,
  ApiBadRequestResponse,
  ApiOperation,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { Request } from 'express';
import * as jwt from 'jsonwebtoken';

import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { SetPasswordDto } from './dto/set-password.dto';
import { JwtAuthGuard } from './jwt-auth.guard';
import { ConfigService } from '@nestjs/config';

@ApiTags('auth') // agrupa como "auth" en Swagger
@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly config: ConfigService,
  ) {}

  // ---------- LOGIN ----------
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Login con email y password' })
  @ApiBody({ type: LoginDto })
  @ApiOkResponse({ description: 'Devuelve JWT y datos de usuario' })
  @ApiUnauthorizedResponse({
    description: 'Credenciales inválidas o cuenta no aprobada',
  })
  async login(@Body() body: LoginDto) {
    const email = (body.email || '').trim().toLowerCase();
    const user = await this.authService.validateUser(email, body.password);
    return this.authService.login(user);
  }

  // ---------- SET PASSWORD (token de invitación) ----------
  @Post('set-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Establecer contraseña con token temporal (invitación)',
    description:
      'El token se genera al invitar/crear usuario. Expira según PASSWORD_JWT_EXPIRES (por defecto 30m).',
  })
  @ApiBody({ type: SetPasswordDto })
  @ApiOkResponse({ description: 'Contraseña establecida', schema: { example: { ok: true } } })
  @ApiBadRequestResponse({ description: 'Token inválido/expirado o contraseñas no coinciden' })
  async setPassword(@Body() dto: SetPasswordDto, @Req() req: Request) {
    return this.authService.setPasswordWithToken(
      dto.token,
      dto.newPassword,
      dto.confirmPassword,
      (req.ip as string) || (req.headers['x-forwarded-for'] as string) || null,
    );
  }

  // ---------- FORGOT PASSWORD ----------
  @Post('forgot-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Solicita un enlace de recuperación de contraseña',
    description:
      'Envía un enlace temporal si el correo existe. En tu implementación actual puede responder 400 si el correo NO existe.',
  })
  @ApiBody({
    schema: {
      type: 'object',
      properties: { email: { type: 'string', format: 'email' } },
      required: ['email'],
    },
  })
  @ApiOkResponse({ schema: { example: { ok: true } } })
  @ApiBadRequestResponse({ description: 'El correo no está registrado' })
  async forgotPassword(@Body('email') emailRaw: string) {
    const email = (emailRaw || '').trim().toLowerCase();
    return this.authService.requestPasswordReset(email);
  }

  // ---------- RESET PASSWORD ----------
  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Cambia la contraseña usando el token de recuperación',
    description:
      'Token de recuperación con expiración limitada (RESET_JWT_EXPIRES/RESET_PASSWORD_JWT_EXPIRES).',
  })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        token: { type: 'string' },
        newPassword: { type: 'string', minLength: 8 },
        confirmPassword: { type: 'string', minLength: 8 },
      },
      required: ['token', 'newPassword', 'confirmPassword'],
    },
  })
  @ApiOkResponse({ schema: { example: { ok: true } } })
  @ApiBadRequestResponse({ description: 'Token inválido/expirado o contraseñas no coinciden' })
  async resetPassword(
    @Body('token') token: string,
    @Body('newPassword') newPassword: string,
    @Body('confirmPassword') confirmPassword: string,
    @Req() req: Request,
  ) {
    return this.authService.resetPasswordWithToken(
      token,
      newPassword,
      confirmPassword,
      (req.ip as string) || (req.headers['x-forwarded-for'] as string) || null,
    );
  }

  // ---------- ME (protegido) ----------
  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('bearer')
  @ApiOperation({ summary: 'Devuelve el usuario del JWT (depuración)' })
  me(@Req() req: Request) {
    return { user: req.user };
  }

  // ---------- Depuración ----------
  @Get('_echo')
  @ApiOperation({ summary: 'Echo del header Authorization (sin guard)' })
  echo(@Req() req: Request) {
    return { authorization: req.headers['authorization'] || null };
  }

  @Post('_verify')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Verifica un token manualmente y muestra payload/error' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: { token: { type: 'string' } },
      required: ['token'],
    },
  })
  verify(@Body('token') token: string) {
    const secret =
      this.config.get<string>('JWT_SECRET') ??
      this.config.get<string>('PASSWORD_JWT_SECRET') ??
      'dev-secret';

    try {
      const payload = jwt.verify(token, secret);
      return { ok: true, payload };
    } catch (e: any) {
      return { ok: false, name: e?.name, message: e?.message };
    }
  }
}
