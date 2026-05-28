// src/SistemaAdmin/collaborator/collaborators.service.ts
import {
  Injectable,
  ConflictException,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import * as bcrypt from 'bcryptjs';
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
  /** Lista completa de roles (multi-rol). Si no se envía, se usa el campo `rol`. */
  roles?: Rol[];
  /** opcional: si no viene, invitamos por email para setear contraseña */
  password?: string;
  estado?: Estado;
  areaId?: number | null;
};

type UpdateData = Partial<Omit<CreateData, 'password'>> & { password?: string; areaId?: number | null };

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
      CollaboratorRol.ADMIN,
      CollaboratorRol.COLABORADORFACTURA,
      CollaboratorRol.COLABORADORVOLUNTARIADO,
      CollaboratorRol.COLABORADORPROYECTO,
      CollaboratorRol.COLABORADORCONTABILIDAD,
      CollaboratorRol.COLABORADORVISITACION,
      CollaboratorRol.COLABORADORSOLICITANTE,
      CollaboratorRol.COLABORADORVOLUNTARIADOEXTERNO,
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

  /**
   * Sincroniza los UserRole del user: agrega los nuevos roles y elimina
   * los que ya no están (solo considera roles de tipo CollaboratorRol).
   */
  private async syncUserRoles(tx: any, userId: number, roles: Rol[]): Promise<void> {
    const allCollabRoleNames = new Set<string>(Object.values(CollaboratorRol));

    // Asegurar existencia de Role records y obtener sus IDs
    const roleRecords: Array<{ id: number }> = await Promise.all(
      roles.map((r) =>
        tx.role.upsert({
          where: { name: r },
          create: { name: r },
          update: {},
          select: { id: true },
        }),
      ),
    );
    const newRoleIds = new Set<number>(roleRecords.map((r) => r.id));

    // Obtener todos los UserRoles actuales del usuario
    const existingLinks: Array<{ id: number; roleId: number; role: { name: string } }> =
      await tx.userRole.findMany({
        where: { userId },
        select: { id: true, roleId: true, role: { select: { name: true } } },
      });

    // Eliminar los que son roles de colaborador pero ya no están en la lista
    const toRemove = existingLinks.filter(
      (link) => allCollabRoleNames.has(link.role.name) && !newRoleIds.has(link.roleId),
    );
    if (toRemove.length > 0) {
      await tx.userRole.deleteMany({
        where: { id: { in: toRemove.map((l) => l.id) } },
      });
    }

    // Agregar los roles que faltan
    const existingRoleIds = new Set<number>(existingLinks.map((l) => l.roleId));
    for (const roleId of newRoleIds) {
      if (!existingRoleIds.has(roleId)) {
        await tx.userRole.create({ data: { userId, roleId } });
      }
    }
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

    // Roles normalizados: si se envían, usarlos; si no, partir del rol primario
    const rolesNormalized: Rol[] = (
      data.roles?.length
        ? data.roles.map((r) => this.normalizeRol(r) ?? CollaboratorRol.COLABORADORPROYECTO)
        : [roleNormalized]
    ).filter((r, i, arr) => arr.indexOf(r) === i); // dedup
    // Asegurar que el rol principal esté en el array
    if (!rolesNormalized.includes(roleNormalized)) rolesNormalized.unshift(roleNormalized);
    const primaryRol: Rol = rolesNormalized[0];

    const { created, user } = await this.prisma.$transaction(async (tx) => {
      const created = await (tx as any).collaborator.create({
        data: {
          nombreCompleto: data.nombreCompleto,
          correo,
          cedula: data.cedula,
          fechaNacimiento: data.fechaNacimiento ? new Date(data.fechaNacimiento) : null,
          telefono: data.telefono ?? null,
          rol: primaryRol,
          roles: rolesNormalized,
          passwordHash,
          estado: estadoNormalized,
          passwordUpdatedAt: new Date(),
          tempPasswordExpiresAt: null,
          areaId: data.areaId ?? null,
        },
        select: {
          id: true,
          nombreCompleto: true,
          correo: true,
          cedula: true,
          fechaNacimiento: true,
          telefono: true,
          rol: true,
          roles: true,
          estado: true,
          areaId: true,
          createdAt: true,
          updatedAt: true,
        },
      });

      const user = await this.ensureUserAndRole(
        tx,
        correo,
        created.nombreCompleto,
        primaryRol,
        passwordHash,
      );
      // Sincronizar todos los roles del colaborador en la tabla User/UserRole
      await this.syncUserRoles(tx, user.id, rolesNormalized);

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
          roles: true,
          estado: true,
          areaId: true,
          areaOrg: { select: { id: true, nombre: true } },
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
        roles: true,
        estado: true,
        areaId: true,
        areaOrg: { select: { id: true, nombre: true } },
        createdAt: true,
        updatedAt: true,
      },
    });
    if (!found) throw new NotFoundException('Colaborador no encontrado');
    return found;
  }

  /** Encuentra el colaborador asociado a un email de usuario. Devuelve null si no existe. */
  async findByEmail(email: string) {
    return this.db.collaborator.findFirst({
      where: { correo: email.toLowerCase().trim() },
      select: {
        id: true,
        nombreCompleto: true,
        correo: true,
        rol: true,
        roles: true,
        estado: true,
        areaId: true,
        areaOrg: { select: { id: true, nombre: true } },
      },
    });
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

    // Roles normalizados (solo si se envían explícitamente)
    let nextRoles: Rol[] | undefined;
    if (data.roles !== undefined) {
      nextRoles = (
        data.roles.length > 0
          ? data.roles.map((r) => this.normalizeRol(r) ?? CollaboratorRol.COLABORADORPROYECTO)
          : [nextRol]
      ).filter((r, i, arr) => arr.indexOf(r) === i);
      // Asegurar rol primario
      if (!nextRoles.includes(nextRol)) nextRoles.unshift(nextRol);
    }

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
          ...(nextRoles !== undefined ? { roles: nextRoles } : {}),
          passwordHash,
          ...(passwordHash
            ? { passwordUpdatedAt: new Date(), tempPasswordExpiresAt: null }
            : {}),
          estado: data.estado !== undefined ? nextEstado : undefined,
          ...(data.areaId !== undefined ? { areaId: data.areaId } : {}),
        },
      });

      // Sincroniza user (garantiza existencia y rol)
      const user = await this.ensureUserAndRole(
        tx,
        nextCorreo,
        data.nombreCompleto ?? existing.nombreCompleto,
        nextRol,
        passwordHash, // si viene, actualizamos password del user
      );
      // Si se enviaron roles, sincronizar todos
      if (nextRoles !== undefined) {
        await this.syncUserRoles(tx, user.id, nextRoles);
      }
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
        roles: true,
        estado: true,
        areaId: true,
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

  // =================== Asignaciones (ColaboradorAsignacion) ===================
  // Solo aplica para rol colaboradorfactura. Controla a qué proyectos/programas
  // puede referir el colaborador al crear solicitudes de pago.

  /** Lista las asignaciones vigentes del colaborador con datos del destino. */
  async listAsignaciones(collaboratorId: number) {
    await this.ensureFactura(collaboratorId);
    return this.db.colaboradorAsignacion.findMany({
      where: { collaboratorId },
      include: {
        project: { select: { id: true, title: true, status: true } },
        programa: { select: { id: true, nombre: true, lugar: true } },
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  /** Asigna un proyecto o programa al colaborador. */
  async asignar(
    collaboratorId: number,
    dto: { projectId?: number; programaId?: number },
  ) {
    await this.ensureFactura(collaboratorId);

    const hasProject = !!dto.projectId;
    const hasPrograma = !!dto.programaId;
    if (hasProject === hasPrograma) {
      throw new BadRequestException(
        'Debe indicar exactamente uno de projectId o programaId.',
      );
    }

    // Verificar que el destino exista
    if (hasProject) {
      const p = await this.prisma.project.findUnique({
        where: { id: dto.projectId },
        select: { id: true },
      });
      if (!p) throw new NotFoundException('Proyecto no encontrado');
    } else {
      const p = await this.prisma.programaVoluntariado.findUnique({
        where: { id: dto.programaId },
        select: { id: true },
      });
      if (!p) throw new NotFoundException('Programa no encontrado');
    }

    // upsert-like: si ya existe, ignorar silenciosamente
    try {
      const asignacion = await this.db.colaboradorAsignacion.create({
        data: {
          collaboratorId,
          projectId: dto.projectId ?? null,
          programaId: dto.programaId ?? null,
        },
        include: {
          project: { select: { id: true, title: true } },
          programa: { select: { id: true, nombre: true } },
        },
      });
      return asignacion;
    } catch (e: any) {
      // P2002 = unique constraint — ya estaba asignado
      if (e?.code === 'P2002') {
        throw new BadRequestException('El colaborador ya tiene esta asignación.');
      }
      throw e;
    }
  }

  /** Elimina una asignación por su id. */
  async desasignar(collaboratorId: number, asignacionId: number) {
    const asignacion = await this.db.colaboradorAsignacion.findFirst({
      where: { id: asignacionId, collaboratorId },
    });
    if (!asignacion) throw new NotFoundException('Asignación no encontrada');

    await this.db.colaboradorAsignacion.delete({
      where: { id: asignacionId },
    });
    return { ok: true };
  }

  /**
   * Devuelve los proyectos y programas disponibles para un colaboradorfactura.
   * Usado por el formulario de nueva solicitud para filtrar el selector.
   */
  async destinosAsignados(collaboratorId: number) {
    const asignaciones = await this.db.colaboradorAsignacion.findMany({
      where: { collaboratorId },
      include: {
        project: { select: { id: true, title: true, status: true, presupuestoTotal: true, monedaPresupuesto: true } },
        programa: { select: { id: true, nombre: true, lugar: true, presupuestoTotal: true, monedaPresupuesto: true } },
      },
    });

    return {
      proyectos: asignaciones
        .filter((a) => a.project !== null)
        .map((a) => a.project!),
      programas: asignaciones
        .filter((a) => a.programa !== null)
        .map((a) => a.programa!),
    };
  }

  // ─── Lista de todos los colaboradores factura (para la página de asignaciones) ───
  async listFactura(params: { q?: string; page: number; pageSize: number }) {
    const where: any = { rol: CollaboratorRol.COLABORADORFACTURA };
    if (params.q?.trim()) {
      where.AND = [
        {
          OR: [
            { nombreCompleto: { contains: params.q, mode: 'insensitive' } },
            { correo: { contains: params.q, mode: 'insensitive' } },
          ],
        },
      ];
    }

    const [items, total] = await Promise.all([
      this.db.collaborator.findMany({
        where,
        orderBy: { nombreCompleto: 'asc' },
        skip: (params.page - 1) * params.pageSize,
        take: params.pageSize,
        select: {
          id: true,
          nombreCompleto: true,
          correo: true,
          rol: true,
          estado: true,
          _count: { select: { asignaciones: true } },
        },
      }),
      this.db.collaborator.count({ where }),
    ]);

    return {
      items,
      total,
      page: params.page,
      pageSize: params.pageSize,
      totalPages: Math.ceil(total / params.pageSize),
    };
  }

  // =================== Colaboradores Externos de Área ===================
  // Roles: colaboradorsolicitante | colaboradorvoluntariadoexterno
  // Solo requieren: nombreCompleto, correo, telefono, areaId

  async createExternal(data: {
    nombreCompleto: string;
    correo: string;
    telefono?: string | null;
    rol: Rol;
    areaId: number;
  }) {
    const correo = this.normalizeEmail(data.correo);

    // Verificar que el área exista
    const area = await this.db.area.findUnique({
      where: { id: data.areaId },
      select: { id: true, nombre: true },
    });
    if (!area) throw new NotFoundException(`Área #${data.areaId} no encontrada`);

    // Verificar unicidad de correo
    const existing = await this.db.collaborator.findFirst({
      where: { correo },
      select: { id: true },
    });
    if (existing) throw new ConflictException('Correo ya está en uso');

    const roleNormalized = this.normalizeRol(data.rol) ?? CollaboratorRol.COLABORADORSOLICITANTE;
    const passwordHash = await bcrypt.hash(generateStrongPassword(12), BCRYPT_COST);

    const { created, user } = await this.prisma.$transaction(async (tx) => {
      const created = await (tx as any).collaborator.create({
        data: {
          nombreCompleto: data.nombreCompleto,
          correo,
          cedula: null,
          fechaNacimiento: null,
          telefono: data.telefono ?? null,
          rol: roleNormalized,
          passwordHash,
          estado: CollaboratorEstado.ACTIVO,
          passwordUpdatedAt: new Date(),
          tempPasswordExpiresAt: null,
          areaId: data.areaId,
        },
        select: {
          id: true,
          nombreCompleto: true,
          correo: true,
          telefono: true,
          rol: true,
          estado: true,
          areaId: true,
          areaOrg: { select: { id: true, nombre: true } },
          createdAt: true,
          updatedAt: true,
        },
      });

      const user = await this.ensureUserAndRole(
        tx,
        correo,
        data.nombreCompleto,
        roleNormalized,
        passwordHash,
      );

      return { created, user };
    });

    // Enviar correo de bienvenida para que establezca su contraseña
    try {
      const secret = this.config.get<string>('PASSWORD_JWT_SECRET');
      if (!secret) throw new Error('PASSWORD_JWT_SECRET no configurado');

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
      console.warn('[EXTERNAL_COLLABORATOR.CREATE] email no enviado:', e?.message || e);
    }

    return created;
  }

  async listExternal(params: {
    q?: string;
    areaId?: number;
    rol?: Rol;
    estado?: string;
    page: number;
    pageSize: number;
  }) {
    const { q, areaId, rol, estado, page, pageSize } = params;

    const where: any = {
      rol: {
        in: [
          CollaboratorRol.COLABORADORSOLICITANTE,
          CollaboratorRol.COLABORADORVOLUNTARIADOEXTERNO,
        ],
      },
    };

    if (q?.trim()) {
      where.AND = [
        {
          OR: [
            { nombreCompleto: { contains: q, mode: 'insensitive' } },
            { correo: { contains: q, mode: 'insensitive' } },
          ],
        },
      ];
    }

    if (areaId) where.areaId = areaId;
    if (rol && [CollaboratorRol.COLABORADORSOLICITANTE, CollaboratorRol.COLABORADORVOLUNTARIADOEXTERNO].includes(rol as any)) {
      where.rol = rol;
    }
    if (estado) where.estado = this.normalizeEstado(estado);

    const [items, total] = await Promise.all([
      this.db.collaborator.findMany({
        where,
        orderBy: { nombreCompleto: 'asc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        select: {
          id: true,
          nombreCompleto: true,
          correo: true,
          telefono: true,
          rol: true,
          estado: true,
          areaId: true,
          areaOrg: { select: { id: true, nombre: true } },
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

  async updateExternal(
    id: number,
    data: {
      nombreCompleto?: string;
      correo?: string;
      telefono?: string | null;
      rol?: Rol;
      areaId?: number | null;
      estado?: Estado;
    },
  ) {
    const existing = await this.db.collaborator.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Colaborador no encontrado');

    // Asegura que sea un rol externo
    if (
      existing.rol !== CollaboratorRol.COLABORADORSOLICITANTE &&
      existing.rol !== CollaboratorRol.COLABORADORVOLUNTARIADOEXTERNO
    ) {
      throw new BadRequestException(
        'Este endpoint solo permite actualizar colaboradores con roles externos.',
      );
    }

    const nextCorreo = data.correo ? this.normalizeEmail(data.correo) : null;
    if (nextCorreo && nextCorreo !== this.normalizeEmail(existing.correo)) {
      const dup = await this.db.collaborator.findFirst({
        where: { correo: nextCorreo, NOT: { id } },
        select: { id: true },
      });
      if (dup) throw new ConflictException('Correo ya está en uso');
    }

    if (data.areaId !== undefined && data.areaId !== null) {
      const area = await this.db.area.findUnique({
        where: { id: data.areaId },
        select: { id: true },
      });
      if (!area) throw new NotFoundException(`Área #${data.areaId} no encontrada`);
    }

    await this.prisma.$transaction(async (tx) => {
      await (tx as any).collaborator.update({
        where: { id },
        data: {
          ...(data.nombreCompleto !== undefined && { nombreCompleto: data.nombreCompleto }),
          ...(nextCorreo !== null && { correo: nextCorreo }),
          ...(data.telefono !== undefined && { telefono: data.telefono }),
          ...(data.rol !== undefined && { rol: this.normalizeRol(data.rol) }),
          ...(data.estado !== undefined && { estado: this.normalizeEstado(data.estado) }),
          ...(data.areaId !== undefined && { areaId: data.areaId }),
        },
      });

      if (nextCorreo || data.nombreCompleto) {
        await this.ensureUserAndRole(
          tx,
          nextCorreo ?? this.normalizeEmail(existing.correo),
          data.nombreCompleto ?? existing.nombreCompleto,
          data.rol
            ? (this.normalizeRol(data.rol) as Rol)
            : (existing.rol as Rol),
        );
      }
    });
  }

  private async ensureFactura(collaboratorId: number) {
    const c = await this.db.collaborator.findUnique({
      where: { id: collaboratorId },
      select: { id: true, rol: true },
    });
    if (!c) throw new NotFoundException('Colaborador no encontrado');
    if (c.rol !== CollaboratorRol.COLABORADORFACTURA) {
      throw new BadRequestException(
        'Las asignaciones de proyectos/programas solo aplican para colaboradores con rol "colaboradorfactura".',
      );
    }
  }
}
