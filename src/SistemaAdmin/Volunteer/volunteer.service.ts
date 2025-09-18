import { Injectable } from '@nestjs/common';
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
    return this.prisma.voluntario.findUnique({ where: { id } });
  }

  async update(id: number, data: UpdateVolunteerDto) {
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
    return this.prisma.voluntario.update({
      where: { id },
      data: { estado },
    });
  }
}
