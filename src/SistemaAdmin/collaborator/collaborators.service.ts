// src/SistemaAdmin/collaborator/collaborators.service.ts
import { Injectable, ConflictException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import * as bcrypt from 'bcrypt';

// Enums locales (strings) para no depender de @prisma/client
type Rol = 'ADMIN' | 'COLABORADOR';
type Estado = 'ACTIVO' | 'INACTIVO';

type CreateData = {
  nombreCompleto: string;
  correo: string;
  cedula: string;
  fechaNacimiento?: string | null; // ISO: YYYY-MM-DD
  telefono?: string | null;
  rol?: Rol;
  password: string;
  estado?: Estado;
};

type UpdateData = Partial<Omit<CreateData, 'password'>> & {
  password?: string;
};

@Injectable()
export class CollaboratorsService {
  constructor(private readonly prisma: PrismaService) {}

  // Getter con cast para destrabar el tipado inmediatamente
  private get db(): any {
    return this.prisma as any;
  }

  async create(data: CreateData) {
    await this.ensureUnique(data.correo, data.cedula);

    const passwordHash = await bcrypt.hash(data.password, 10);

    return this.db.collaborator.create({
      data: {
        nombreCompleto: data.nombreCompleto,
        correo: data.correo,
        cedula: data.cedula,
        fechaNacimiento: data.fechaNacimiento ? new Date(data.fechaNacimiento) : null,
        telefono: data.telefono ?? null,
        rol: (data.rol ?? 'COLABORADOR') as Rol,
        passwordHash,
        estado: (data.estado ?? 'ACTIVO') as Estado,
      },
    });
  }

  async list(params: {
    q?: string;
    rol?: Rol;
    estado?: Estado;
    page: number;
    pageSize: number;
  }) {
    const { q, rol, estado, page, pageSize } = params;

    const where: any = {};
    if (q && q.trim()) {
      where.OR = [
        { nombreCompleto: { contains: q, mode: 'insensitive' } },
        { correo: { contains: q, mode: 'insensitive' } },
        { cedula: { contains: q, mode: 'insensitive' } },
        { telefono: { contains: q, mode: 'insensitive' } },
      ];
    }
    if (rol) where.rol = rol;
    if (estado) where.estado = estado;

    const [items, total] = await this.prisma.$transaction([
      this.db.collaborator.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        select: {
          id: true,
          nombreCompleto: true,
          correo: true,
          cedula: true,
          fechaNacimiento: true,
          telefono: true,
          rol: true,
          estado: true,
          createdAt: true,
          updatedAt: true,
        },
      }),
      this.db.collaborator.count({ where }),
    ]);

    return {
      items,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  }

  async findById(id: number) {
    const found = await this.db.collaborator.findUnique({
      where: { id },
      select: {
        id: true,
        nombreCompleto: true,
        correo: true,
        cedula: true,
        fechaNacimiento: true,
        telefono: true,
        rol: true,
        estado: true,
        createdAt: true,
        updatedAt: true,
      },
    });
    if (!found) throw new NotFoundException('Colaborador no encontrado');
    return found;
  }

  async update(id: number, data: UpdateData) {
    const existing = await this.db.collaborator.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Colaborador no encontrado');

    const nextCorreo = data.correo ?? existing.correo;
    const nextCedula = data.cedula ?? existing.cedula;
    if (nextCorreo !== existing.correo || nextCedula !== existing.cedula) {
      await this.ensureUnique(nextCorreo, nextCedula, id);
    }

    const passwordHash = data.password ? await bcrypt.hash(data.password, 10) : undefined;

    return this.db.collaborator.update({
      where: { id },
      data: {
        nombreCompleto: data.nombreCompleto,
        correo: data.correo,
        cedula: data.cedula,
        fechaNacimiento:
          data.fechaNacimiento === undefined
            ? undefined
            : data.fechaNacimiento
            ? new Date(data.fechaNacimiento)
            : null,
        telefono: data.telefono,
        rol: data.rol as Rol | undefined,
        passwordHash, // solo si vino password
        estado: data.estado as Estado | undefined,
      },
      select: {
        id: true,
        nombreCompleto: true,
        correo: true,
        cedula: true,
        fechaNacimiento: true,
        telefono: true,
        rol: true,
        estado: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }

  async remove(id: number) {
    try {
      await this.db.collaborator.delete({ where: { id } });
      return { ok: true };
    } catch {
      throw new NotFoundException('Colaborador no encontrado');
    }
  }

  private async ensureUnique(correo: string, cedula: string, ignoreId?: number) {
    const found = await this.db.collaborator.findFirst({
      where: {
        OR: [{ correo }, { cedula }],
        ...(ignoreId ? { NOT: { id: ignoreId } } : {}),
      },
      select: { id: true, correo: true, cedula: true },
    });

    if (found) {
      if (found.correo === correo) throw new ConflictException('Correo ya está en uso');
      if (found.cedula === cedula) throw new ConflictException('Cédula ya está en uso');
    }
  }
}
