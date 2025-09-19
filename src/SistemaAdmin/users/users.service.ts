import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { QueryUserDto } from './dto/query-user.dto';
import { AssignRolesDto } from './dto/assign-roles.dto';
import * as bcrypt from 'bcrypt';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as crypto from 'crypto';
import { EmailService } from '../../common/services/email.service';

@Injectable()
export class UsersService {
  constructor(
    private prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly jwt: JwtService,
    private readonly email: EmailService,
  ) {}

  // ---------- CREATE (envía correo de bienvenida con token 30m) ----------
  async create(dto: CreateUserDto) {
    const exists = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });
    if (exists) throw new BadRequestException('El correo ya está en uso');
    if (!dto.password)
      throw new BadRequestException('La contraseña es obligatoria');

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

    // Enviar bienvenida (no rompe el create si falla)
    try {
      const secret = this.config.get<string>('PASSWORD_JWT_SECRET');
      if (!secret) {
        throw new BadRequestException(
          'PASSWORD_JWT_SECRET no configurado en el servidor',
        );
      }
      const expiresIn =
        this.config.get<string | number>('PASSWORD_JWT_EXPIRES') ?? '30m';

      const token = await this.jwt.signAsync(
        { email: user.email, userId: user.id },
        { secret, expiresIn, jwtid: crypto.randomUUID() },
      );

      const sendEmailsEnv = (
        this.config.get<string>('SEND_EMAILS') ?? 'true'
      ).toLowerCase();
      const sendEmails = sendEmailsEnv !== 'false';

      if (!sendEmails) {
        const link = this.email.buildSetPasswordLink(token);
        // eslint-disable-next-line no-console
        console.log('[CREATE-DRY-RUN] SEND_EMAILS=false ->', link);
        return { ...(await this.findOne(user.id)), welcomeLink: link, mode: 'DRY_RUN' };
      }

      await this.email.sendWelcomeSetPasswordEmail(user.email, token);
    } catch (e: any) {
      // eslint-disable-next-line no-console
      console.warn(
        '[CREATE] Aviso: no se pudo enviar el email de bienvenida:',
        e?.message || e,
      );
    }

    return this.findOne(user.id);
  }

  // ---------- INVITAR (crea si no existe, asigna roles, genera token 30m, envía correo) ----------
  async inviteUser({
    email,
    name,
    roles,
  }: {
    email: string;
    name?: string;
    roles?: string[];
  }) {
    // eslint-disable-next-line no-console
    console.log('[INVITE-DEBUG] dto=', { email, name, roles });
    if (!email) throw new BadRequestException('email es requerido');

    try {
      // 1) Usuario
      let user = await this.prisma.user.findUnique({ where: { email } });
      // eslint-disable-next-line no-console
      console.log('[INVITE-DEBUG] user.exists?', !!user);

      if (!user) {
        const tempPlain = crypto.randomBytes(16).toString('hex');
        const tempHash = await bcrypt.hash(tempPlain, 10);

        user = await this.prisma.user.create({
          data: {
            email,
            name: name ?? email.split('@')[0],
            verified: false,
            password: tempHash,
          },
        });
        // eslint-disable-next-line no-console
        console.log('[INVITE-DEBUG] user.created', user.id);
      }

      // 2) Roles
      if (roles?.length) {
        for (const r of roles) {
          const role = await this.prisma.role.upsert({
            where: { name: r },
            create: { name: r },
            update: {},
          });
          const existsRel = await this.prisma.userRole.findFirst({
            where: { userId: user.id, roleId: role.id },
          });
          if (!existsRel) {
            await this.prisma.userRole.create({
              data: { userId: user.id, roleId: role.id },
            });
          }
        }
      }

      // 3) Token
      const secret = this.config.get<string>('PASSWORD_JWT_SECRET');
      if (!secret) {
        throw new BadRequestException(
          'PASSWORD_JWT_SECRET no configurado en el servidor',
        );
      }
      const expiresIn =
        this.config.get<string | number>('PASSWORD_JWT_EXPIRES') ?? '30m';

      const token = await this.jwt.signAsync(
        { email: user.email, userId: user.id },
        { secret, expiresIn, jwtid: crypto.randomUUID() },
      );
      // eslint-disable-next-line no-console
      console.log('[INVITE-DEBUG] token.created');

      // 4) Modo dry-run
      const sendEmailsEnv = (
        this.config.get<string>('SEND_EMAILS') ?? 'true'
      ).toLowerCase();
      const sendEmails = sendEmailsEnv !== 'false';

      if (!sendEmails) {
        const link = this.email.buildSetPasswordLink(token);
        // eslint-disable-next-line no-console
        console.log('[INVITE-DEBUG] SEND_EMAILS=false, link=', link);
        return { ok: true, userId: user.id, link, mode: 'DRY_RUN' };
      }

      // 5) Envío real
      await this.email.sendWelcomeSetPasswordEmail(user.email, token);
      // eslint-disable-next-line no-console
      console.log('[INVITE-DEBUG] email.sent');

      return { ok: true, userId: user.id };
    } catch (e: any) {
      // eslint-disable-next-line no-console
      console.error('[INVITE-ERROR]', e?.response?.body ?? e?.message ?? e);
      if (e?.status && e?.status < 500) throw e;
      throw new InternalServerErrorException(
        e?.message || 'Error interno en invitación',
      );
    }
  }

  // ---------- LIST ----------
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

  // ---------- GET ----------
  async findOne(id: number) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      include: { roles: { include: { role: true } } },
    });
    if (!user) throw new NotFoundException('Usuario no encontrado');
    return user;
  }

  // ---------- UPDATE ----------
  async update(id: number, dto: UpdateUserDto) {
    const data: any = {};
    if (dto.email !== undefined) data.email = dto.email;
    if (dto.name !== undefined) data.name = dto.name;
    if (dto.verified !== undefined) data.verified = dto.verified;
    if (dto.password) data.password = await bcrypt.hash(dto.password, 10);

    await this.prisma.user.update({ where: { id }, data });

    if (dto.roles) {
      await this.prisma.userRole.deleteMany({ where: { userId: id } });
      for (const r of dto.roles) {
        const role = await this.prisma.role.upsert({
          where: { name: r },
          create: { name: r },
          update: {},
        });
        await this.prisma.userRole.create({
          data: { userId: id, roleId: role.id },
        });
      }
    }

    return this.findOne(id);
  }

  // ---------- DELETE ----------
  async remove(id: number) {
    await this.prisma.user.delete({ where: { id } });
    return { message: 'Usuario eliminado' };
  }

  // ---------- VERIFY / APPROVE ----------
  async verifyUser(id: number, verified: boolean) {
    await this.prisma.user.update({ where: { id }, data: { verified } });
    return this.findOne(id);
  }

  // ✅ Ahora siempre deja approved=true (sin body)
  async approveUser(id: number) {
    await this.prisma.user.update({ where: { id }, data: { approved: true } });
    return this.findOne(id);
  }

  // ---------- ROLES ----------
  async addRole(id: number, roleName: string) {
    const role = await this.prisma.role.upsert({
      where: { name: roleName },
      create: { name: roleName },
      update: {},
    });
    const exists = await this.prisma.userRole.findFirst({
      where: { userId: id, roleId: role.id },
    });
    if (!exists) {
      await this.prisma.userRole.create({
        data: { userId: id, roleId: role.id },
      });
    }
    return this.findOne(id);
  }

  async removeRole(id: number, roleName: string) {
    const role = await this.prisma.role.findUnique({ where: { name: roleName } });
    if (!role) return this.findOne(id);
    await this.prisma.userRole.deleteMany({ where: { userId: id, roleId: role.id } });
    return this.findOne(id);
  }

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
      throw new BadRequestException('Algún rol no existe');
    }

    await this.prisma.userRole.createMany({
      data: roles.map((r) => ({ userId, roleId: r.id })),
      skipDuplicates: true,
    });

    return this.getUserRoles(userId);
  }

  async removeRoleById(userId: number, roleId: number) {
    await this.prisma.userRole.deleteMany({ where: { userId, roleId } });
    return this.getUserRoles(userId);
  }
}
