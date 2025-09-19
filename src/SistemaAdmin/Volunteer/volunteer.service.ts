import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateVolunteerDto } from './dto/create-volunteer.dto';
import { UpdateVolunteerDto } from './dto/update-volunteer.dto';

@Injectable()
export class VolunteerService {
  constructor(private readonly prisma: PrismaService) {}

  async create(data: CreateVolunteerDto) {
    return this.prisma.voluntario.create({
      data: {
        tipoDocumento: data.tipoDocumento,
        numeroDocumento: data.numeroDocumento,
        nombreCompleto: data.nombreCompleto,
        email: data.email,
        telefono: data.telefono ?? null,
        // convertir fechas si vienen; si no, Prisma aplica defaults (fechaIngreso now())
        fechaNacimiento: data.fechaNacimiento ? new Date(data.fechaNacimiento) : undefined,
        fechaIngreso: data.fechaIngreso ? new Date(data.fechaIngreso) : undefined,
        estado: data.estado, // opcional; si no viene, Prisma default(ACTIVO)
      },
    });
  }

  async findAll({
    skip,
    take,
    orderBy,
    where,
  }: {
    skip: number;
    take: number;
    orderBy: any;
    where?: any;
  }) {
    const [data, total] = await Promise.all([
      this.prisma.voluntario.findMany({ skip, take, orderBy, where }),
      this.prisma.voluntario.count({ where }),
    ]);
    return { data, total };
  }

  async findOne(id: number) {
    const found = await this.prisma.voluntario.findUnique({ where: { id } });
    if (!found) throw new NotFoundException(`Voluntario ${id} no encontrado`);
    return found;
  }

  async update(id: number, data: UpdateVolunteerDto) {
    // valida existencia primero para que el error sea claro
    await this.findOne(id);
    return this.prisma.voluntario.update({
      where: { id },
      data: {
        tipoDocumento: data.tipoDocumento,
        numeroDocumento: data.numeroDocumento,
        nombreCompleto: data.nombreCompleto,
        email: data.email,
        telefono: data.telefono ?? undefined,
        fechaNacimiento: data.fechaNacimiento ? new Date(data.fechaNacimiento) : undefined,
        fechaIngreso: data.fechaIngreso ? new Date(data.fechaIngreso) : undefined,
        estado: data.estado ?? undefined,
      },
    });
  }

  async toggleStatus(id: number, estado: 'ACTIVO' | 'INACTIVO') {
    // valida existencia primero
    await this.findOne(id);
    return this.prisma.voluntario.update({
      where: { id },
      data: { estado },
    });
  }

  // 👇 NUEVO: eliminar (borrado físico)
  async remove(id: number) {
    // valida existencia primero para lanzar 404 si no existe
    await this.findOne(id);
    return this.prisma.voluntario.delete({
      where: { id },
    });
  }
}
