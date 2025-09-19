// src/SistemaAdmin/users/users.debug.open.controller.ts
import { Body, Controller, Post } from '@nestjs/common';
import { ApiBody, ApiTags } from '@nestjs/swagger';
import { UsersService } from './users.service';
import { InviteUserDto } from './dto/invite-user.dto';

@ApiTags('Users (Debug Open)')
@Controller('admin/users-open')
export class UsersDebugOpenController {
  constructor(private readonly usersService: UsersService) {}

  @Post('invite-debug-open')
  @ApiBody({ type: InviteUserDto })
  async inviteDebugOpen(@Body() dto: InviteUserDto) {
    try {
      return await this.usersService.inviteUser(dto);
    } catch (e: any) {
      // eslint-disable-next-line no-console
      console.error('[INVITE-DEBUG-OPEN-ERROR]', e?.message ?? e);
      return { ok: false, name: e?.name, message: e?.message, status: e?.status };
    }
  }
}
