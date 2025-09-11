import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
  ) {}

  async validateUser(email: string, password: string) {
    const user = await this.prisma.user.findUnique({
      where: { email },
      include: { roles: { include: { role: true } } },
    });

    if (!user) throw new UnauthorizedException('Correo o contraseña incorrectos');

    const passwordValid = await bcrypt.compare(password, user.password);

    if (!passwordValid) throw new UnauthorizedException('Correo o contraseña incorrectos');

    if (!user.verified) throw new UnauthorizedException('Usuario no verificado');

    return user;
  }

  async login(user: any) {
    const payload = {
      sub: user.id,
      email: user.email,
      roles: user.roles.map(r => r.role.name),
    };
    return {
      access_token: this.jwtService.sign(payload),
    };
  }
}
