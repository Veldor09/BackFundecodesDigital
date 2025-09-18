import {
  Injectable,
  ConflictException,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import * as bcrypt from 'bcrypt';
import { generateStrongPassword } from '../../common/utils/password.util';
import { WelcomeFlowService } from '../../common/services/welcome-flow.service';

const BCRYPT_COST = 12;

type Rol = 'ADMIN' | 'COLABORADOR';
type Estado = 'ACTIVO' | 'INACTIVO';

type CreateData = {
  nombreCompleto: string;
  correo: string;
  cedula: string;
  fechaNacimiento?: string | null;
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
  constructor(
    private readonly prisma: PrismaService,
    private readonly welcome: WelcomeFlowService,
  ) {}

  // acceso flexible mientras los tipos de Prisma se regeneran
  private get db(): any {
    return this.prisma as any;
  }

  private ensureAge18(fechaISO?: string | null) {
    if (!fechaISO) return;
    const d = new Date(fechaISO);
    if (Number.isNaN(d.getTime())) {
      throw new BadRequestException(
        'fechaNacimiento inválida (formato esperado YYYY-MM-DD)',
      );
    }
    const now = new Date();
    let age = now.getFullYear() - d.getFullYear();
    const hadBirthdayThisYear =
      now.getMonth() > d.getMonth() ||
      (now.getMonth() === d.getMonth() && now.getDate() >= d.getDate());
    if (!hadBirthdayThisYear) age -= 1;
    if (age < 18) {
      throw new BadRequestException('El colaborador debe ser mayor de 18 años');
    }
  }

  private async ensureUnique(
    correo: string,
    cedula: string,
    ignoreId?: number,
  ) {
    const found = await this.db.collaborator.findFirst({
      where: {
        OR: [{ correo }, { cedula }],
        ...(ignoreId ? { NOT: { id: ignoreId } } : {}),
      },
      select: { id: true, correo: true, cedula: true },
    });
    if (found) {
      if (found.correo === correo)
        throw new ConflictException('Correo ya está en uso');
      if (found.cedula === cedula)
        throw new ConflictException('Cédula ya está en uso');
    }
  }

  // ========== NUEVO: Protección "último admin activo" ==========

  /** ¿Este usuario es el último administrador ACTIVO del sistema? */
  private async isLastActiveAdmin(userId: number): Promise<boolean> {
    const totalAdminsActivos: number = await this.db.collaborator.count({
      where: { rol: 'ADMIN', estado: 'ACTIVO' },
    });

    if (totalAdminsActivos <= 1) {
      const me = await this.db.collaborator.findUnique({
        where: { id: userId },
        select: { rol: true, estado: true },
      });
      return !!me && me.rol === 'ADMIN' && me.estado === 'ACTIVO';
    }
    return false;
  }

  /**
   * Lanza 400 si el cambio dejaría al sistema sin administradores activos.
   * Se usa dentro de update() y deactivate().
   */
  private async ensureNotDemoteLastAdmin(
    id: number,
    nextRol: Rol,
    nextEstado: Estado,
  ): Promise<void> {
    const wouldLoseAdmin = nextRol !== 'ADMIN';
    const wouldBeInactive = nextEstado !== 'ACTIVO';
    if (wouldLoseAdmin || wouldBeInactive) {
      if (await this.isLastActiveAdmin(id)) {
        throw new BadRequestException(
          'Acción bloqueada: es el único administrador ACTIVO restante.',
        );
      }
    }
  }

  /**
   * Método PÚBLICO para que el controller exponga un endpoint
   * de verificación previa (no lanza excepción, devuelve {safe,reason}).
   */
  async checkAdminChangeSafety(
    id: number,
    nextRol: Rol,
    nextEstado: Estado,
  ): Promise<{ safe: boolean; reason?: string }> {
    try {
      await this.ensureNotDemoteLastAdmin(id, nextRol, nextEstado);
      return { safe: true };
    } catch (e: any) {
      return { safe: false, reason: e?.message ?? 'Operación no segura' };
    }
  }

  // =============================================================

  async create(data: CreateData) {
    await this.ensureUnique(data.correo, data.cedula);
    this.ensureAge18(data.fechaNacimiento);

    const passwordHash = await bcrypt.hash(data.password, BCRYPT_COST);

    const created = await this.db.collaborator.create({
      data: {
        nombreCompleto: data.nombreCompleto,
        correo: data.correo,
        cedula: data.cedula,
        fechaNacimiento: data.fechaNacimiento
          ? new Date(data.fechaNacimiento)
          : null,
        telefono: data.telefono ?? null,
        rol: (data.rol ?? 'COLABORADOR') as Rol,
        passwordHash,
        estado: (data.estado ?? 'ACTIVO') as Estado,
        passwordUpdatedAt: new Date(),
        tempPasswordExpiresAt: null,
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

    // correo de bienvenida con link set-password (no bloquea la respuesta)
    void this.welcome
      .onCollaboratorCreated({
        id: created.id,
        correo: created.correo,
        nombreCompleto: created.nombreCompleto,
      })
      .catch(() => {});

    return created;
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

  async update(id: number, data: UpdateData): Promise<void> {
    const existing = await this.db.collaborator.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Colaborador no encontrado');

    const nextCorreo = data.correo ?? existing.correo;
    const nextCedula = data.cedula ?? existing.cedula;
    if (nextCorreo !== existing.correo || nextCedula !== existing.cedula) {
      await this.ensureUnique(nextCorreo, nextCedula, id);
    }
    if (data.fechaNacimiento !== undefined) {
      this.ensureAge18(data.fechaNacimiento);
    }

    // 👇 validar “último admin activo” antes de aplicar cambios
    const nextRol = (data.rol ?? existing.rol) as Rol;
    const nextEstado = (data.estado ?? existing.estado) as Estado;
    await this.ensureNotDemoteLastAdmin(id, nextRol, nextEstado);

    const passwordHash = data.password
      ? await bcrypt.hash(data.password, BCRYPT_COST)
      : undefined;

    await this.db.collaborator.update({
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
        passwordHash,
        ...(passwordHash
          ? { passwordUpdatedAt: new Date(), tempPasswordExpiresAt: null }
          : {}),
        estado: data.estado as Estado | undefined,
      },
    });
  }

  async deactivate(id: number): Promise<void> {
    const existing = await this.db.collaborator.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Colaborador no encontrado');
    if (existing.estado === 'INACTIVO') return; // idempotente

    // 👇 bloquear si es el último admin activo
    if (await this.isLastActiveAdmin(id)) {
      throw new BadRequestException(
        'No puedes desactivar al único administrador ACTIVO restante.',
      );
    }

    await this.db.collaborator.update({
      where: { id },
      data: { estado: 'INACTIVO' as Estado },
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

  async issueTemporaryPassword(id: number): Promise<void> {
    const user = await this.db.collaborator.findUnique({ where: { id } });
    if (!user) throw new NotFoundException('Colaborador no encontrado');

    const tempPwd = generateStrongPassword(12); // NO exponer por respuesta
    const passwordHash = await bcrypt.hash(tempPwd, BCRYPT_COST);

    const expires = new Date();
    expires.setDate(expires.getDate() + 7);

    await this.db.collaborator.update({
      where: { id },
      data: {
        passwordHash,
        tempPasswordExpiresAt: expires,
        passwordUpdatedAt: new Date(),
      },
    });
  }
}
