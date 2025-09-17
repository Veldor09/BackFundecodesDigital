// src/SistemaAdmin/roles/roles.service.ts
import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateRoleDto } from './dto/create-role.dto';
import { UpdateRoleDto } from './dto/update-role.dto';

type PermissionView = { id: number; key: string; description: string | null };
type RoleView = {
  id: number;
  name: string;
  permissions: PermissionView[];
  _count?: { users: number };
};

@Injectable()
export class RolesService {
  constructor(private prisma: PrismaService) {}

  /** helper: trae un rol + sus permisos (segunda query para evitar include/select conflictivo) */
  private async getRoleWithPermissions(id: number): Promise<RoleView> {
    const role = await this.prisma.role.findUnique({
      where: { id },
      select: { id: true, name: true },
    });
    if (!role) throw new NotFoundException('Rol no encontrado');

    // usamos any en prisma.permission para esquivar tipos cacheados
    const permissions = await (this.prisma as any).permission.findMany({
      where: { roles: { some: { id } } },
      select: { id: true, key: true, description: true },
    });

    return { ...role, permissions };
  }

  /** valida que las keys existan y devuelve IDs */
  private async ensurePermissionIds(keys: string[] = []) {
    if (!keys.length) return [];
    const perms = await (this.prisma as any).permission.findMany({
      where: { key: { in: keys } },
      select: { id: true, key: true },
    });

    if (perms.length !== keys.length) {
      const found = new Set(perms.map((p: any) => p.key));
      const missing = keys.filter((k) => !found.has(k));
      throw new BadRequestException(
        `Permisos inexistentes: ${missing.join(', ')}`,
      );
    }
    return perms.map((p: any) => p.id);
  }

  async create(dto: CreateRoleDto): Promise<RoleView> {
    // unicidad
    const exists = await this.prisma.role.findUnique({
      where: { name: dto.name },
    });
    if (exists) throw new BadRequestException('El rol ya existe');

    // 1) crea el rol SIN permissions (evita TS2353 en create)
    const created = await this.prisma.role.create({
      data: { name: dto.name },
      select: { id: true },
    });

    // 2) si enviaron permisos, conéctalos con un UPDATE separado
    if (dto.permissionKeys?.length) {
      const permIds = await this.ensurePermissionIds(dto.permissionKeys);
      const connect = permIds.map((id) => ({ id }));

      // cast a any para evitar que TS moleste si el cliente está cacheado
      await this.prisma.role.update({
        where: { id: created.id },
        data: { permissions: { set: [], connect } as any },
        select: { id: true },
      });
    }

    return this.getRoleWithPermissions(created.id);
  }

  async findAll(): Promise<RoleView[]> {
    const roles = await this.prisma.role.findMany({
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    });

    // tipa explícitamente el arreglo para evitar never[]
    const results: RoleView[] = [];
    for (const r of roles) {
      const permissions: PermissionView[] = await (
        this.prisma as any
      ).permission.findMany({
        where: { roles: { some: { id: r.id } } },
        select: { id: true, key: true, description: true },
      });

      const usersCount = await this.prisma.userRole.count({
        where: { roleId: r.id },
      });

      results.push({
        id: r.id,
        name: r.name,
        permissions,
        _count: { users: usersCount },
      });
    }

    return results;
  }

  async findOne(id: number): Promise<RoleView> {
    return this.getRoleWithPermissions(id);
  }

  async update(id: number, dto: UpdateRoleDto): Promise<RoleView> {
    // validar colisión de nombre
    if (dto.name) {
      const dup = await this.prisma.role.findUnique({
        where: { name: dto.name },
      });
      if (dup && dup.id !== id)
        throw new BadRequestException('Ya existe un rol con ese nombre');
    }

    // 1) actualiza nombre (si viene)
    if (dto.name) {
      await this.prisma.role.update({
        where: { id },
        data: { name: dto.name },
        select: { id: true },
      });
    }

    // 2) sincroniza permisos (si vienen)
    if (dto.permissionKeys) {
      const permIds = await this.ensurePermissionIds(dto.permissionKeys);
      const connect = permIds.map((pid) => ({ id: pid }));
      await this.prisma.role.update({
        where: { id },
        data: { permissions: { set: [], connect } }, // use correct relation field
        select: { id: true },
      });
    }

    return this.getRoleWithPermissions(id);
  }

  async remove(id: number) {
    const withUsers = await this.prisma.userRole.count({
      where: { roleId: id },
    });
    if (withUsers > 0) {
      throw new BadRequestException(
        'No se puede eliminar: hay usuarios que tienen este rol',
      );
    }
    await this.prisma.role.delete({ where: { id } });
    return { message: 'Rol eliminado' };
  }
}
