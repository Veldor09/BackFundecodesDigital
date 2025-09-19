// src/common/services/email.service.ts
import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import { PrismaService } from '../../prisma/prisma.service';

type EmailLogStatus = 'PENDING' | 'RETRYING' | 'SENT' | 'FAILED';
const MAX_ATTEMPTS = 3;

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);

  private transporter: nodemailer.Transporter;
  private readonly from: string;
  private readonly frontendUrl?: string;
  private readonly setPasswordPath: string;
  private readonly resetPasswordPath: string;
  private readonly sendEmails: boolean;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {
    // === SMTP (Gmail con App Password) ===
    const host = this.config.get<string>('MAIL_HOST') || 'smtp.gmail.com';
    const port = Number(this.config.get<string>('MAIL_PORT') || '587');
    const user = this.config.get<string>('MAIL_USERNAME') || '';
    const pass = this.config.get<string>('MAIL_PASSWORD') || '';

    this.transporter = nodemailer.createTransport({
      host,
      port,
      secure: false, // STARTTLS en 587
      auth: user && pass ? { user, pass } : undefined,
    });

    this.transporter
      .verify()
      .then(() => this.logger.log('[SMTP] Conexión OK'))
      .catch((e) =>
        this.logger.warn(`[SMTP] No se pudo verificar la conexión: ${e?.message || e}`),
      );

    // Control de envíos reales (dev/testing)
    const sendEmailsEnv = (this.config.get<string>('SEND_EMAILS') ?? 'true').toLowerCase();
    this.sendEmails = sendEmailsEnv !== 'false';

    // Remitente (para Gmail, ideal que sea el mismo MAIL_USERNAME)
    this.from =
      this.config.get<string>('MAIL_FROM') ||
      (user ? `Fundecodes <${user}>` : 'Fundecodes <no-reply@test.mlsender.net>');

    // Front-end y rutas
    this.frontendUrl = this.config.get<string>('FRONTEND_URL') || undefined;
    this.setPasswordPath =
      this.config.get<string>('FRONTEND_SET_PASSWORD_PATH') || '/set-password';
    this.resetPasswordPath =
      this.config.get<string>('FRONTEND_RESET_PASSWORD_PATH') || '/reset-password';
  }

  // Prisma (flexible por si los tipos aún no incluyen EmailLog)
  private get db(): any {
    return this.prisma as any;
  }

  // ===== Helpers de logging tolerantes =====
  private async safeLogCreate(data: any) {
    try {
      return await this.db.emailLog.create({ data });
    } catch {
      this.logger.warn('[EmailLog.create] omitido (dev / tabla no existe)');
      return { id: 0 };
    }
  }
  private async safeLogUpdate(where: any, data: any) {
    try {
      return await this.db.emailLog.update({ where, data });
    } catch {
      // noop si tabla no existe
    }
  }

  // ===== Builder genérico de links =====
  private buildLinkWithPath(token: string, path: string) {
    if (!this.frontendUrl) {
      this.logger.error('FRONTEND_URL no está definido; usando ruta relativa');
      const p = path.startsWith('/') ? path : `/${path}`;
      return `${p}?token=${encodeURIComponent(token)}`;
    }
    const base = this.frontendUrl.replace(/\/+$/, '');
    const p = path.startsWith('/') ? path : `/${path}`;
    return `${base}${p}?token=${encodeURIComponent(token)}`;
  }

  /** Link para establecer contraseña tras invitación */
  buildSetPasswordLink(token: string) {
    return this.buildLinkWithPath(token, this.setPasswordPath);
  }

  /** Link para recuperación de contraseña */
  buildResetPasswordLink(token: string) {
    return this.buildLinkWithPath(token, this.resetPasswordPath);
  }

  // ===== Reintentos con backoff =====
  private async sendWithRetry(sendFn: () => Promise<void>, logId: number) {
    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      try {
        await this.safeLogUpdate(
          { id: logId },
          { attempt, status: attempt === 1 ? ('PENDING' as EmailLogStatus) : ('RETRYING' as EmailLogStatus) },
        );
        await sendFn();
        await this.safeLogUpdate({ id: logId }, { status: 'SENT' as EmailLogStatus });
        return;
      } catch (err: any) {
        const msg = err?.message || String(err);
        await this.safeLogUpdate(
          { id: logId },
          {
            status: attempt < MAX_ATTEMPTS ? ('RETRYING' as EmailLogStatus) : ('FAILED' as EmailLogStatus),
            error: msg.slice(0, 1000),
          },
        );
        this.logger.warn(`[SMTP] intento ${attempt} falló: ${msg}`);
        if (attempt < MAX_ATTEMPTS) {
          await new Promise((r) => setTimeout(r, 500 * Math.pow(2, attempt - 1)));
        } else {
          throw new BadRequestException(`SMTP error: ${msg}`);
        }
      }
    }
  }

  // ===== Email de bienvenida con link para establecer contraseña =====
  async sendWelcomeSetPasswordEmail(to: string, tokenOrLink: string) {
    const link = tokenOrLink.startsWith('http')
      ? tokenOrLink
      : this.buildSetPasswordLink(tokenOrLink);

    const subject = 'Bienvenido(a) a FUNDECODES — Establece tu contraseña';
    const html = `
      <div style="font-family: Arial, sans-serif; line-height:1.6">
        <p>¡Hola!</p>
        <p>Has sido registrado como colaborador en FUNDECODES.</p>
        <p>Para establecer tu contraseña (vigente por tiempo limitado), haz clic aquí:</p>
        <p>
          <a href="${link}" target="_blank" rel="noopener" style="display:inline-block;padding:10px 16px;border-radius:8px;text-decoration:none;background:#0ea5e9;color:#fff;">
            Establecer contraseña
          </a>
        </p>
        <p>Si el botón no funciona, copia y pega este enlace en tu navegador:</p>
        <p><a href="${link}">${link}</a></p>
      </div>
    `;

    const log = await this.safeLogCreate({
      to,
      subject,
      template: 'welcome-set-password',
      payload: { link },
      status: 'PENDING' as EmailLogStatus,
    });

    // Modo dev (o envío deshabilitado)
    if (!this.sendEmails) {
      this.logger.warn(`[DEV-EMAIL OFF] To: ${to}`);
      this.logger.warn(`[DEV-EMAIL OFF] Subject: ${subject}`);
      this.logger.debug(`[DEV-EMAIL OFF] LINK: ${link}`);
      await this.safeLogUpdate({ id: log.id }, { attempt: 1, status: 'SENT' as EmailLogStatus });
      return;
    }

    // Envío real con reintentos
    await this.sendWithRetry(
      () =>
        this.transporter.sendMail({
          from: this.from,
          to,
          subject,
          html,
          text: `Establece tu contraseña: ${link}`,
        }),
      log.id,
    );

    this.logger.log(`Email (welcome) enviado a ${to}`);
  }

  // ===== Email de recuperación de contraseña =====
  async sendResetPasswordEmail(to: string, tokenOrLink: string) {
    const link = tokenOrLink.startsWith('http')
      ? tokenOrLink
      : this.buildResetPasswordLink(tokenOrLink);

    const subject = 'Recupera tu contraseña';
    const html = `
      <div style="font-family: Arial, sans-serif; line-height:1.6">
        <p>Recibimos una solicitud para restablecer tu contraseña.</p>
        <p>Haz clic en el botón para establecer una nueva contraseña. Este enlace vence pronto.</p>
        <p>
          <a href="${link}" target="_blank" rel="noopener" style="display:inline-block;padding:10px 16px;border-radius:8px;text-decoration:none;background:#0ea5e9;color:#fff;">
            Restablecer contraseña
          </a>
        </p>
        <p>Si no solicitaste este cambio, ignora este mensaje.</p>
        <p>Enlace directo: <a href="${link}">${link}</a></p>
      </div>
    `;

    const log = await this.safeLogCreate({
      to,
      subject,
      template: 'reset-password',
      payload: { link },
      status: 'PENDING' as EmailLogStatus,
    });

    if (!this.sendEmails) {
      this.logger.warn(`[DEV-EMAIL OFF] To: ${to}`);
      this.logger.debug(`[DEV-EMAIL OFF] LINK: ${link}`);
      await this.safeLogUpdate({ id: log.id }, { attempt: 1, status: 'SENT' as EmailLogStatus });
      return;
    }

    await this.sendWithRetry(
      () =>
        this.transporter.sendMail({
          from: this.from,
          to,
          subject,
          html,
          text: `Restablece tu contraseña: ${link}`,
        }),
      log.id,
    );

    this.logger.log(`Email (reset) enviado a ${to}`);
  }
}
