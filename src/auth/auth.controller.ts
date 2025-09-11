import { Body, Controller, Post } from '@nestjs/common';
import { ApiTags, ApiBody, ApiOkResponse, ApiUnauthorizedResponse } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';

@ApiTags('Auth') // <- agrupa en Swagger
@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Post('login')
  @ApiBody({ type: LoginDto })
  @ApiOkResponse({
    schema: {
      properties: {
        access_token: { type: 'string', example: 'eyJhbGciOiJIUzI1NiIsInR5...' },
      },
    },
    description: 'Devuelve el JWT si el usuario está verificado',
  })
  @ApiUnauthorizedResponse({ description: 'Credenciales inválidas o usuario no verificado' })
  async login(@Body() body: LoginDto) {
    const user = await this.authService.validateUser(body.email, body.password);
    return this.authService.login(user);
  }
}
