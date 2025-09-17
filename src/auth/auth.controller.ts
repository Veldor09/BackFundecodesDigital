// src/auth/auth.controller.ts
import { Body, Controller, Post } from '@nestjs/common';
import {
  ApiTags,
  ApiBody,
  ApiOkResponse,
  ApiUnauthorizedResponse,
  ApiBadRequestResponse,
  ApiOperation,
} from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { SetPasswordDto } from './dto/set-password.dto';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  // --- LOGIN ---
  @Post('login')
  @ApiOperation({ summary: 'Login con email y password' })
  @ApiBody({ type: LoginDto })
  @ApiOkResponse({
    description:
      'Devuelve el JWT si las credenciales son válidas y la cuenta está aprobada',
    schema: {
      properties: {
        access_token: {
          type: 'string',
          example: 'eyJhbGciOiJIUzI1NiIsInR5...',
        },
        user: {
          type: 'object',
          properties: {
            id: { type: 'number', example: 12 },
            email: { type: 'string', example: 'user@fundecodes.org' },
            name: { type: 'string', example: 'Usuario Demo' },
            verified: { type: 'boolean', example: true },
            approved: { type: 'boolean', example: true },
            roles: {
              type: 'array',
              items: { type: 'string' },
              example: ['admin'],
            },
            perms: {
              type: 'array',
              items: { type: 'string' },
              example: ['users.manage'],
            },
          },
        },
      },
    },
  })
  @ApiUnauthorizedResponse({
    description: 'Credenciales inválidas o cuenta no aprobada',
  })
  async login(@Body() body: LoginDto) {
    const user = await this.authService.validateUser(body.email, body.password);
    return this.authService.login(user);
  }

  // --- SET PASSWORD (con token de bienvenida, 30 min) ---
  @Post('set-password')
  @ApiOperation({
    summary: 'Establecer contraseña definitiva con token (30 min)',
    description:
      'Recibe un token JWT enviado por correo al crear colaborador y la nueva contraseña. No devuelve datos sensibles.',
  })
  @ApiBody({
    type: SetPasswordDto,
    examples: {
      ejemplo: {
        summary: 'Ejemplo',
        value: {
          token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
          newPassword: 'Nuev4Cl@ve2024!',
        },
      },
    },
  })
  @ApiOkResponse({
    description: 'Contraseña establecida correctamente',
    schema: { example: { ok: true } },
  })
  @ApiBadRequestResponse({ description: 'Token inválido o expirado' })
  async setPassword(@Body() dto: SetPasswordDto) {
    return this.authService.setPasswordWithToken(dto.token, dto.newPassword);
  }
}
