import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';

/**
 * 🧾 Interfaz para los datos de auditoría
 */
interface AuditoriaInput {
  userId?: number;
  accion: string;
  detalle?: string;
}

/**
 * 📘 Servicio encargado de registrar las acciones de auditoría
 */
@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * 🧾 Registra una acción en la tabla Auditoria
   * @param data Datos de la acción (usuario, acción, detalle)
   */
  async registrarAccion(data: AuditoriaInput) {
    try {
      console.log('🪶 Registrando auditoría:', data); // Log de depuración temporal

      const auditoria = await this.prisma.auditoria.create({
        data: {
          userId: data.userId ?? null,
          accion: data.accion,
          detalle: data.detalle ?? '',
        },
      });

      console.log('✅ Auditoría registrada:', auditoria.id);

      return { ok: true, auditoria };
    } catch (error) {
      console.error('❌ Error registrando auditoría:', error);
      throw new InternalServerErrorException(
        'Error al registrar la auditoría',
      );
    }
  }
}
