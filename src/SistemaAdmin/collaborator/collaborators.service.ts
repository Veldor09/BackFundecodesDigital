// src/SistemaAdmin/collaborator/collaborators.service.ts
import {
  Injectable,
  ConflictException,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import * as bcrypt from 'bcrypt';
import { generateStrongPassword } from '../../common/utils/password.util';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as crypto from 'crypto';
import { EmailService } from '../../common/services/email.service';
import { CollaboratorRol } from './dto/collaborator-rol.enum';
import { CollaboratorEstado } from './dto/collaborator-estado.enum';

const BCRYPT_COST = 12;

type Rol = CollaboratorRol;
type Estado = CollaboratorEstado;

type CreateData = {
  nombreCompleto: string;
  correo: string;
  cedula: string;
  fechaNacimiento?: string | null;
  telefono?: string | null;
  rol?: Rol;
  /** opcional: si no viene, invitamos por email para setear contraseña */
  password?: string;
  estado?: Estado;
};

type UpdateData = Partial<Omit<CreateData, 'password'>> & { password?: string };

@Injectable()
export class CollaboratorsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly jwt: JwtService,
    private readonly email: EmailService,
  ) {}

  // Acceso flexible a tablas personalizadas mientras regeneras tipos
  private get db(): any {
    return this.prisma as any;
  }

  // ----------------- Helpers -----------------
  /** Normaliza rol a minúsculas y lo valida contra el enum actual */
  private normalizeRol(v?: any): Rol | undefined {
    if (!v) return undefined;
    const low = String(v).trim().toLowerCase();

    const allowed = new Set<string>([
      CollaboratorRol.ADMIN,                     // 'admin'
      CollaboratorRol.COLABORADORFACTURA,       // 'colaboradorfactura'
      CollaboratorRol.COLABORADORVOLUNTARIADO,  // 'colaboradorvoluntariado'
      CollaboratorRol.COLABORADORPROYECTO,      // 'colaboradorproyecto'
      CollaboratorRol.COLABORADORCONTABILIDAD,  // 'colaboradorcontabilidad'
    ]);

    return (allowed.has(low) ? (low as Rol) : CollaboratorRol.COLABORADORPROYECTO);
  }

  /** Normaliza estado a MAYÚSCULAS y lo valida */
  private normalizeEstado(v?: any): Estado | undefined {
    if (!v) return undefined;
    const up = String(v).trim().toUpperCase();
    return up === CollaboratorEstado.INACTIVO
      ? CollaboratorEstado.INACTIVO
      : CollaboratorEstado.ACTIVO;
  }

  private normalizeEmail(v?: string | null) {
    return (v ?? '').trim().toLowerCase();
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

  private async ensureUnique(correoRaw: string, cedula: string, ignoreId?: number) {
    const correo = this.normalizeEmail(correoRaw);
    const found = await this.db.collaborator.findFirst({
      where: {
        OR: [{ correo }, { cedula }],
        ...(ignoreId ? { NOT: { id: ignoreId } } : {}),
      },
      select: { id: true, correo: true, cedula: true },
    });
    if (found) {
      if (this.normalizeEmail(found.correo) === correo)
        throw new ConflictException('Correo ya está en uso');
      if (found.cedula === cedula)
        throw new ConflictException('Cédula ya está en uso');
    }
  }

  // ========== Protección "último admin activo" ==========
  private async isLastActiveAdmin(userId: number): Promise<boolean> {
    const totalAdminsActivos: number = await this.db.collaborator.count({
      where: { rol: CollaboratorRol.ADMIN, estado: CollaboratorEstado.ACTIVO },
    });

    if (totalAdminsActivos <= 1) {
      const me = await this.db.collaborator.findUnique({
        where: { id: userId },
        select: { rol: true, estado: true },
      });
      return !!me && me.rol === CollaboratorRol.ADMIN && me.estado === CollaboratorEstado.ACTIVO;
    }
    return false;
  }

  private async ensureNotDemoteLastAdmin(
    id: number,
    nextRol: Rol,
    nextEstado: Estado,
  ): Promise<void> {
    const wouldLoseAdmin = nextRol !== CollaboratorRol.ADMIN;
    const wouldBeInactive = nextEstado !== CollaboratorEstado.ACTIVO;
    if (wouldLoseAdmin || wouldBeInactive) {
      if (await this.isLastActiveAdmin(id)) {
        throw new BadRequestException(
          'Acción bloqueada: es el único administrador ACTIVO restante.',
        );
      }
    }
  }

  /** Endpoint de verificación previa (no lanza excepción) */
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

  /** Asegura que el user exista y tenga el rol; devuelve { id, email } */
  private async ensureUserAndRole(
    tx: any,
    email: string,
    name: string | null | undefined,
    rol: Rol,
    passwordHash?: string,
  ): Promise<{ id: number; email: string }> {
    const correo = this.normalizeEmail(email);

    // Busca user por email (shape ligero)
    let user = await tx.user.findUnique({
      where: { email: correo },
      select: { id: true, email: true },
    });

    if (!user) {
      // Si no hay hash, generamos temporal
      const hash = passwordHash ?? (await bcrypt.hash(generateStrongPassword(12), BCRYPT_COST));
      user = await tx.user.create({
        data: {
          email: correo,
          name: name ?? correo.split('@')[0],
          approved: true,
          verified: false,
          password: hash,
        },
        select: { id: true, email: true },
      });
    } else if (passwordHash) {
      await tx.user.update({
        where: { id: user.id },
        data: { password: passwordHash, name: name ?? undefined },
      });
    } else if (name !== undefined) {
      await tx.user.update({
        where: { id: user.id },
        data: { name: name ?? undefined },
      });
    }

    // Rol (tabla de roles generales)
    const role = await tx.role.upsert({
      where: { name: rol },
      create: { name: rol },
      update: {},
      select: { id: true },
    });
    const rel = await tx.userRole.findFirst({
      where: { userId: user.id, roleId: role.id },
      select: { id: true },
    });
    if (!rel) {
      await tx.userRole.create({ data: { userId: user.id, roleId: role.id } });
    }

    return user; // { id, email }
  }

  // ----------------- CRUD -----------------
  async create(data: CreateData) {
    const correo = this.normalizeEmail(data.correo);
    await this.ensureUnique(correo, data.cedula);
    this.ensureAge18(data.fechaNacimiento);

    const plainPassword =
      data.password && data.password.trim().length >= 8
        ? data.password.trim()
        : generateStrongPassword(12);
    const passwordHash = await bcrypt.hash(plainPassword, BCRYPT_COST);

    // Normalizamos rol/estado antes de persistir
    const roleNormalized: Rol =
      this.normalizeRol(data.rol) ?? CollaboratorRol.COLABORADORPROYECTO;
    const estadoNormalized: Estado =
      this.normalizeEstado(data.estado) ?? CollaboratorEstado.ACTIVO;

    const { created, user } = await this.prisma.$transaction(async (tx) => {
      const created = await (tx as any).collaborator.create({
        data: {
          nombreCompleto: data.nombreCompleto,
          correo,
          cedula: data.cedula,
          fechaNacimiento: data.fechaNacimiento ? new Date(data.fechaNacimiento) : null,
          telefono: data.telefono ?? null,
          rol: roleNormalized,
          passwordHash,
          estado: estadoNormalized,
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

      const user = await this.ensureUserAndRole(
        tx,
        correo,
        created.nombreCompleto,
        roleNormalized,
        passwordHash,
      );

      return { created, user };
    });

    // Genera token de invitación (30m) y envía correo (no rompe si falla)
    try {
      const secret = this.config.get<string>('PASSWORD_JWT_SECRET');
      if (!secret) throw new BadRequestException('PASSWORD_JWT_SECRET no configurado en el servidor');

      const expiresIn = this.config.get<string | number>('PASSWORD_JWT_EXPIRES') ?? '30m';

      const token = await this.jwt.signAsync(
        { email: user.email, userId: user.id },
        { secret, expiresIn, jwtid: crypto.randomUUID() },
      );

      const sendEmails = (this.config.get<string>('SEND_EMAILS') ?? 'true').toLowerCase() !== 'false';
      if (!sendEmails) {
        const link = this.email.buildSetPasswordLink(token);
        return { ...created, welcomeLink: link, mode: 'DRY_RUN' as const };
      }

      await this.email.sendWelcomeSetPasswordEmail(user.email, token);
    } catch (e: any) {
      // eslint-disable-next-line no-console
      console.warn('[COLLABORATOR.CREATE] email no enviado:', e?.message || e);
    }

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
    if (rol) where.rol = this.normalizeRol(rol);
    if (estado) where.estado = this.normalizeEstado(estado);

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

    const nextCorreo = data.correo ? this.normalizeEmail(data.correo) : this.normalizeEmail(existing.correo);
    const nextCedula = data.cedula ?? existing.cedula;

    if (
      nextCorreo !== this.normalizeEmail(existing.correo) ||
      nextCedula !== existing.cedula
    ) {
      await this.ensureUnique(nextCorreo, nextCedula, id);
    }
    if (data.fechaNacimiento !== undefined) {
      this.ensureAge18(data.fechaNacimiento);
    }

    // Normaliza antes de validar y persistir
    const nextRol: Rol = this.normalizeRol(data.rol ?? existing.rol) as Rol;
    const nextEstado: Estado = this.normalizeEstado(data.estado ?? existing.estado) as Estado;

    await this.ensureNotDemoteLastAdmin(id, nextRol, nextEstado);

    const passwordHash = data.password
      ? await bcrypt.hash(data.password, BCRYPT_COST)
      : undefined;

    await this.prisma.$transaction(async (tx) => {
      await (tx as any).collaborator.update({
        where: { id },
        data: {
          nombreCompleto: data.nombreCompleto,
          correo: data.correo ? nextCorreo : undefined,
          cedula: data.cedula,
          fechaNacimiento:
            data.fechaNacimiento === undefined
              ? undefined
              : data.fechaNacimiento
              ? new Date(data.fechaNacimiento)
              : null,
          telefono: data.telefono,
          rol: data.rol !== undefined ? nextRol : undefined,
          passwordHash,
          ...(passwordHash
            ? { passwordUpdatedAt: new Date(), tempPasswordExpiresAt: null }
            : {}),
          estado: data.estado !== undefined ? nextEstado : undefined,
        },
      });

      // Sincroniza user (garantiza existencia y rol)
      await this.ensureUserAndRole(
        tx,
        nextCorreo,
        data.nombreCompleto ?? existing.nombreCompleto,
        nextRol,
        passwordHash, // si viene, actualizamos password del user
      );
    });
  }

  // -------- TOGGLE STATUS ----------
  async toggleStatus(id: number) {
    const existing = await this.db.collaborator.findUnique({
      where: { id },
      select: { id: true, estado: true, rol: true },
    });
    if (!existing) throw new NotFoundException('Colaborador no encontrado');

    const nextEstado: Estado =
      existing.estado === CollaboratorEstado.ACTIVO
        ? CollaboratorEstado.INACTIVO
        : CollaboratorEstado.ACTIVO;

    if (nextEstado === CollaboratorEstado.INACTIVO) {
      if (await this.isLastActiveAdmin(id)) {
        throw new BadRequestException(
          'No puedes desactivar al único administrador ACTIVO restante.',
        );
      }
    }

    const updated = await this.db.collaborator.update({
      where: { id },
      data: { estado: nextEstado },
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

    return updated;
  }

  async deactivate(id: number): Promise<void> {
    const existing = await this.db.collaborator.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Colaborador no encontrado');
    if (existing.estado === CollaboratorEstado.INACTIVO) return;

    if (await this.isLastActiveAdmin(id)) {
      throw new BadRequestException(
        'No puedes desactivar al único administrador ACTIVO restante.',
      );
    }

    await this.db.collaborator.update({
      where: { id },
      data: { estado: CollaboratorEstado.INACTIVO as Estado },
    });
  }

  // DELETE (para 204 No Content)
  async remove(id: number): Promise<void> {
    const existing = await this.db.collaborator.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Colaborador no encontrado');
    await this.db.collaborator.delete({ where: { id } });
  }

  /** Password temporal manual (soporte) */
  async issueTemporaryPassword(id: number): Promise<void> {
    const user = await this.db.collaborator.findUnique({ where: { id } });
    if (!user) throw new NotFoundException('Colaborador no encontrado');

    const tempPwd = generateStrongPassword(12);
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
