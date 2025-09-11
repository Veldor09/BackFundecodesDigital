import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { QueryUserDto } from './dto/query-user.dto';
import * as bcrypt from 'bcrypt';

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  async create(dto: CreateUserDto) {
    const exists = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (exists) throw new BadRequestException('El correo ya está en uso');

    const password = await bcrypt.hash(dto.password, 10);
    const verified = dto.verified ?? false;

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
    const data: any = { ...dto };
    if (dto.password) data.password = await bcrypt.hash(dto.password, 10);
    delete data.roles;

    await this.prisma.user.update({ where: { id }, data });

    // Si quieren actualizar roles desde este endpoint (opcional):
    if (dto.roles) {
      const current = await this.prisma.userRole.findMany({ where: { userId: id } });
      // elimina relaciones actuales
      if (current.length) {
        await this.prisma.userRole.deleteMany({ where: { userId: id } });
      }
      // crea nuevas
      for (const r of dto.roles) {
        const role = await this.prisma.role.upsert({
          where: { name: r },
          create: { name: r },
          update: {},
        });
        await this.prisma.userRole.create({ data: { userId: id, roleId: role.id } });
      }
    }

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
}
