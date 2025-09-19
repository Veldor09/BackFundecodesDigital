// src/SistemaAdmin/users/users.dev.controller.ts
import { Body, Controller, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { UsersService } from './users.service';

@ApiTags('Users (DEV)')
@Controller('admin/users')
export class UsersDevController {
  constructor(private readonly usersService: UsersService) {}

  // Ruta de prueba SIN guards para aislar problemas
  @Post('invite-dev')
  inviteDev(@Body() dto: { email: string; name?: string; roles?: string[] }) {
    return this.usersService.inviteUser(dto);
  }
}
