import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { QueryUserDto } from './dto/query-user.dto';
import { AssignRolesDto } from './dto/assign-roles.dto';
import * as bcrypt from 'bcrypt';

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  async create(dto: CreateUserDto) {
    const exists = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (exists) throw new BadRequestException('El correo ya está en uso');

    const password = await bcrypt.hash(dto.password, 10);
    const verified = dto.verified ?? false;
    // ⚠️ No usamos approved aquí para evitar error de tipos si el cliente no está actualizado
    const user = await this.prisma.user.create({
      data: { email: dto.email, name: dto.name, password, verified },
    });

    if (dto.roles?.length) {
      for (const r of dto.roles) {
        const role = await this.prisma.role.upsert({
          where: { name: r },
          create: { name: r },
          update: {},
        });
        await this.prisma.userRole.create({
          data: { userId: user.id, roleId: role.id },
        });
      }
    }

    // Si quisieras setear approved en el momento de creación,
    // hazlo con una segunda operación:
    // if ((dto as any).approved !== undefined) {
    //   await this.prisma.user.update({ where: { id: user.id }, data: { approved: (dto as any).approved } as any });
    // }

    return this.findOne(user.id);
  }

  async findAll(q: QueryUserDto) {
    const { page = 1, limit = 10, search, verified, role } = q;

    const where: any = {};
    if (typeof verified === 'boolean') where.verified = verified;
    if (search) {
      where.OR = [
        { email: { contains: search, mode: 'insensitive' } },
        { name: { contains: search, mode: 'insensitive' } },
      ];
    }
    if (role) where.roles = { some: { role: { name: role } } };

    const [total, items] = await this.prisma.$transaction([
      this.prisma.user.count({ where }),
      this.prisma.user.findMany({
        where,
        include: { roles: { include: { role: true } } },
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    return { total, page, limit, items };
  }

  async findOne(id: number) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      include: { roles: { include: { role: true } } },
    });
    if (!user) throw new NotFoundException('Usuario no encontrado');
    return user;
  }

  async update(id: number, dto: UpdateUserDto) {
    // Construye datos seguros: evita approved aquí para no chocar con tipos viejos
    const data: any = {};
    if (dto.email !== undefined) data.email = dto.email;
    if (dto.name !== undefined) data.name = dto.name;
    if (dto.verified !== undefined) data.verified = dto.verified;
    if (dto.password) data.password = await bcrypt.hash(dto.password, 10);

    await this.prisma.user.update({ where: { id }, data });

    // Si quieren actualizar roles desde este endpoint:
    if (dto.roles) {
      const current = await this.prisma.userRole.findMany({ where: { userId: id } });
      if (current.length) {
        await this.prisma.userRole.deleteMany({ where: { userId: id } });
      }
      for (const r of dto.roles) {
        const role = await this.prisma.role.upsert({
          where: { name: r },
          create: { name: r },
          update: {},
        });
        await this.prisma.userRole.create({ data: { userId: id, roleId: role.id } });
      }
    }

    // Si necesitas cambiar approved desde aquí:
    // if ((dto as any).approved !== undefined) {
    //   await this.prisma.user.update({ where: { id }, data: { approved: (dto as any).approved } as any });
    // }

    return this.findOne(id);
  }

  async remove(id: number) {
    await this.prisma.user.delete({ where: { id } });
    return { message: 'Usuario eliminado' };
  }

  async verifyUser(id: number, verified: boolean) {
    await this.prisma.user.update({ where: { id }, data: { verified } });
    return this.findOne(id);
  }

  // ✅ método explícito para approved (lo usa el front y evita el problema en UpdateInput)
  async approveUser(id: number, approved: boolean) {
    // @ts-ignore (se puede quitar tras regenerar el cliente)
    await this.prisma.user.update({ where: { id }, data: { approved } as any });
    return this.findOne(id);
  }

  async addRole(id: number, roleName: string) {
    const role = await this.prisma.role.upsert({
      where: { name: roleName },
      create: { name: roleName },
      update: {},
    });
    const exists = await this.prisma.userRole.findFirst({ where: { userId: id, roleId: role.id } });
    if (!exists) {
      await this.prisma.userRole.create({ data: { userId: id, roleId: role.id } });
    }
    return this.findOne(id);
  }

  async removeRole(id: number, roleName: string) {
    const role = await this.prisma.role.findUnique({ where: { name: roleName } });
    if (!role) return this.findOne(id);
    const rel = await this.prisma.userRole.findFirst({ where: { userId: id, roleId: role.id } });
    if (rel) await this.prisma.userRole.delete({ where: { id: rel.id } });
    return this.findOne(id);
  }

  // ==========================
  // Métodos por IDs (batch)
  // ==========================
  async getUserRoles(userId: number) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { roles: { include: { role: true } } },
    });
    if (!user) throw new NotFoundException('Usuario no encontrado');
    return user.roles.map((ur) => ur.role);
  }

  async assignRoles(userId: number, dto: AssignRolesDto) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('Usuario no encontrado');

    const roles = await this.prisma.role.findMany({
      where: { id: { in: dto.roleIds } },
      select: { id: true },
    });

    if (roles.length !== dto.roleIds.length) {
      const found = new Set(roles.map((r) => r.id));
      const missing = dto.roleIds.filter((id) => !found.has(id));
      throw new BadRequestException(`Roles inexistentes: ${missing.join(', ')}`);
    }

    await this.prisma.userRole.createMany({
      data: roles.map((r) => ({ userId, roleId: r.id })),
      skipDuplicates: true, // requiere @@unique([userId, roleId]) en Prisma
    });

    return this.getUserRoles(userId);
  }

  async removeRoleById(userId: number, roleId: number) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('Usuario no encontrado');

    const res = await this.prisma.userRole.deleteMany({
      where: { userId, roleId },
    });

    if (res.count === 0) {
      throw new NotFoundException('El usuario no tiene asignado ese rol');
    }

    return this.getUserRoles(userId);
  }
}
