import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateRespuestaFormularioDto } from './dto/create-respuesta-formulario.dto';
import { QueryRespuestaFormularioDto } from './dto/query-respuesta-formulario.dto';
import { UpdateEstadoRespuestaDto } from './dto/update-estado-respuesta.dto';

@Injectable()
export class RespuestasFormularioService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Crear una nueva respuesta de formulario
   */
  async create(dto: CreateRespuestaFormularioDto) {
    this.validatePayloadByFormType(dto.tipoFormulario, dto.payload);

    return this.prisma.respuestaFormulario.create({
      data: {
        tipoFormulario: dto.tipoFormulario as any,
        nombre: dto.nombre?.trim() || null,
        correo: dto.correo?.trim().toLowerCase() || null,
        telefono: dto.telefono?.trim() || null,
        payload: dto.payload,
      },
    });
  }

  /**
   * Obtener todas las respuestas con filtros:
   * - tipoFormulario
   * - estado
   * - search (nombre, correo, teléfono)
   * - paginación
   */
  async findAll(query: QueryRespuestaFormularioDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 10;
    const skip = (page - 1) * limit;

    const where: any = {};

    if (query.tipoFormulario) {
      where.tipoFormulario = query.tipoFormulario;
    }

    if (query.estado) {
      where.estado = query.estado;
    }

    if (query.search?.trim()) {
      const term = query.search.trim();

      where.OR = [
        { nombre: { contains: term, mode: 'insensitive' } },
        { correo: { contains: term, mode: 'insensitive' } },
        { telefono: { contains: term, mode: 'insensitive' } },
      ];
    }

    const [items, total] = await Promise.all([
      this.prisma.respuestaFormulario.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.respuestaFormulario.count({ where }),
    ]);

    return {
      data: items,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Contar respuestas pendientes solo de CONTACTO y VOLUNTARIADO
   */
  async getPendingCount() {
    const [contacto, voluntariado] = await Promise.all([
      this.prisma.respuestaFormulario.count({
        where: {
          tipoFormulario: 'CONTACTO',
          estado: 'PENDIENTE',
        },
      }),
      this.prisma.respuestaFormulario.count({
        where: {
          tipoFormulario: 'VOLUNTARIADO',
          estado: 'PENDIENTE',
        },
      }),
    ]);

    return {
      contacto,
      voluntariado,
      total: contacto + voluntariado,
    };
  }

  /**
   * Buscar una respuesta por ID
   */
  async findOne(id: string) {
    const respuesta = await this.prisma.respuestaFormulario.findUnique({
      where: { id },
    });

    if (!respuesta) {
      throw new NotFoundException('La respuesta del formulario no fue encontrada');
    }

    return respuesta;
  }

  /**
   * Cambiar el estado del formulario
   * Estados esperados por el frontend: PENDIENTE | ACEPTADO | RECHAZADO
   */
  async updateEstado(id: string, dto: UpdateEstadoRespuestaDto) {
    await this.findOne(id);

    return this.prisma.respuestaFormulario.update({
      where: { id },
      data: {
        estado: dto.estado as any,
      },
    });
  }

  /**
   * Validar que el payload tenga lo necesario para cada tipo de formulario
   */
  private validatePayloadByFormType(
    tipoFormulario: string,
    payload: Record<string, any>,
  ) {
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
      throw new BadRequestException('El payload debe ser un objeto válido');
    }

    switch (tipoFormulario) {
      case 'CONTACTO':
        this.validateContacto(payload);
        break;

      case 'VOLUNTARIADO':
        this.validateVoluntariado(payload);
        break;

      case 'ALIANZA':
        this.validateAlianza(payload);
        break;

      case 'COMENTARIO':
        this.validateComentario(payload);
        break;

      default:
        throw new BadRequestException('Tipo de formulario no soportado');
    }
  }

  /** Validación del formulario de CONTACTO */
  private validateContacto(payload: Record<string, any>) {
    if (
      !payload.mensaje ||
      typeof payload.mensaje !== 'string' ||
      !payload.mensaje.trim()
    ) {
      throw new BadRequestException(
        'El mensaje es obligatorio para el formulario de contacto',
      );
    }

    if (payload.mensaje.trim().length < 5) {
      throw new BadRequestException(
        'El mensaje debe tener al menos 5 caracteres',
      );
    }
  }

  /** Validación del formulario de VOLUNTARIADO */
  private validateVoluntariado(payload: Record<string, any>) {
    if (
      !payload.disponibilidad ||
      typeof payload.disponibilidad !== 'string' ||
      !payload.disponibilidad.trim()
    ) {
      throw new BadRequestException(
        'La disponibilidad es obligatoria para el formulario de voluntariado',
      );
    }

    if (
      !payload.areaInteres ||
      typeof payload.areaInteres !== 'string' ||
      !payload.areaInteres.trim()
    ) {
      throw new BadRequestException(
        'El área de interés es obligatoria para el formulario de voluntariado',
      );
    }
  }

  /** Validación del formulario de ALIANZA */
  private validateAlianza(payload: Record<string, any>) {
    if (
      !payload.organizacion ||
      typeof payload.organizacion !== 'string' ||
      !payload.organizacion.trim()
    ) {
      throw new BadRequestException(
        'La organización es obligatoria para el formulario de alianza',
      );
    }

    if (
      !payload.propuesta ||
      typeof payload.propuesta !== 'string' ||
      !payload.propuesta.trim()
    ) {
      throw new BadRequestException(
        'La propuesta es obligatoria para el formulario de alianza',
      );
    }
  }

  /** Validación del formulario de COMENTARIO */
  private validateComentario(payload: Record<string, any>) {
    if (
      !payload.comentario ||
      typeof payload.comentario !== 'string' ||
      !payload.comentario.trim()
    ) {
      throw new BadRequestException('El comentario es obligatorio');
    }

    if (payload.comentario.trim().length < 3) {
      throw new BadRequestException(
        'El comentario debe tener al menos 3 caracteres',
      );
    }
  }
}