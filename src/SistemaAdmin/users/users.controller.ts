import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiTags } from '@nestjs/swagger';

import { UsersService } from './users.service';

// DTOs
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { QueryUserDto } from './dto/query-user.dto';
import { AssignRolesDto } from './dto/assign-roles.dto';
import { InviteUserDto } from './dto/invite-user.dto';

// Guards / permisos
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { Permissions } from '../../common/decorators/permissions.decorator';

@ApiTags('Users')
@ApiBearerAuth('bearer')
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Permissions('users.manage')
@Controller('admin/users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  // -------- CRUD ----------
  @Post()
  create(@Body() dto: CreateUserDto) {
    return this.usersService.create(dto);
  }

  @Get()
  list(@Query() q: QueryUserDto) {
    return this.usersService.findAll(q);
  }

  @Get(':id')
  get(@Param('id', ParseIntPipe) id: number) {
    return this.usersService.findOne(id);
  }

  @Patch(':id')
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateUserDto) {
    return this.usersService.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.usersService.remove(id);
  }

  // -------- Verificación / Aprobación ----------
  @Patch(':id/verify')
  verify(
    @Param('id', ParseIntPipe) id: number,
    @Body('verified') verified: boolean,
  ) {
    return this.usersService.verifyUser(id, verified);
  }

  // ✅ Sin body; siempre aprueba en true
  @Patch(':id/approve')
  approve(@Param('id', ParseIntPipe) id: number) {
    return this.usersService.approveUser(id);
  }

  // -------- Invitación (PROTEGIDO) ----------
  @Post('invite')
  @ApiBody({ type: InviteUserDto })
  invite(@Body() dto: InviteUserDto) {
    return this.usersService.inviteUser(dto);
  }

  // -------- Roles por nombre ----------
  @Post(':id/roles/:role')
  addRole(@Param('id', ParseIntPipe) id: number, @Param('role') role: string) {
    return this.usersService.addRole(id, role);
  }

  @Delete(':id/roles/:role')
  removeRole(
    @Param('id', ParseIntPipe) id: number,
    @Param('role') role: string,
  ) {
    return this.usersService.removeRole(id, role);
  }

  // -------- Roles por ID ----------
  @Get(':id/roles')
  getUserRoles(@Param('id', ParseIntPipe) id: number) {
    return this.usersService.getUserRoles(id);
  }

  @Post(':id/roles')
  assignRoles(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: AssignRolesDto,
  ) {
    return this.usersService.assignRoles(id, dto);
  }

  @Delete(':id/roles/:roleId')
  removeRoleById(
    @Param('id', ParseIntPipe) id: number,
    @Param('roleId', ParseIntPipe) roleId: number,
  ) {
    return this.usersService.removeRoleById(id, roleId);
  }

  // (Opcional) Echo para pruebas rápidas del body
  @Post('_echo')
  echo(@Body() body: any) {
    return { received: body };
  }
}
