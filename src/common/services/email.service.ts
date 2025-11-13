// src/common/services/email.service.ts
import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Resend } from 'resend';
import { PrismaService } from '../../prisma/prisma.service';

type EmailLogStatus = 'PENDING' | 'RETRYING' | 'SENT' | 'FAILED';
const MAX_ATTEMPTS = 3;

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);

  private resend?: Resend;
  private readonly from: string;
  private readonly frontendUrl?: string;
  private readonly setPasswordPath: string;
  private readonly resetPasswordPath: string;
  private readonly sendEmails: boolean;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {
    const sendEmailsEnv = (this.config.get<string>('SEND_EMAILS') ?? 'true').toLowerCase();
    const resendApiKey = this.config.get<string>('RESEND_API_KEY') || '';

    if (resendApiKey) {
      this.resend = new Resend(resendApiKey);
    } else {
      this.logger.warn('[Email] RESEND_API_KEY no está definido; no se enviarán correos reales.');
    }

    this.sendEmails = !!resendApiKey && sendEmailsEnv !== 'false';

    if (!this.sendEmails) {
      this.logger.warn(
        '[DEV-EMAIL OFF] Envío de correos deshabilitado (SEND_EMAILS=false o sin RESEND_API_KEY)',
      );
    }

    // Remitente
    this.from =
      this.config.get<string>('MAIL_FROM') ||
      this.config.get<string>('RESEND_FROM') ||
      'Fundecodes <no-reply@test.mlsender.net>';

    // Front-end y rutas
    this.frontendUrl = this.config.get<string>('FRONTEND_URL') || undefined;
    this.setPasswordPath =
      this.config.get<string>('FRONTEND_SET_PASSWORD_PATH') || '/set-password';
    this.resetPasswordPath =
      this.config.get<string>('FRONTEND_RESET_PASSWORD_PATH') || '/reset-password';
  }

  // Prisma (tolerante si EmailLog aún no existe)
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
    if (!this.resend) {
      throw new BadRequestException('Servicio de email no configurado correctamente.');
    }

    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      try {
        await this.safeLogUpdate(
          { id: logId },
          {
            attempt,
            status: attempt === 1 ? ('PENDING' as EmailLogStatus) : ('RETRYING' as EmailLogStatus),
          },
        );

        await sendFn();

        await this.safeLogUpdate({ id: logId }, { status: 'SENT' as EmailLogStatus });
        return;
      } catch (err: any) {
        const msg = err?.message || String(err);
        await this.safeLogUpdate(
          { id: logId },
          {
            status:
              attempt < MAX_ATTEMPTS ? ('RETRYING' as EmailLogStatus) : ('FAILED' as EmailLogStatus),
            error: msg.slice(0, 1000),
          },
        );
        this.logger.warn(`[Resend] intento ${attempt} falló: ${msg}`);

        if (attempt < MAX_ATTEMPTS) {
          await new Promise((r) => setTimeout(r, 500 * Math.pow(2, attempt - 1)));
        } else {
          throw new BadRequestException(`Error enviando email: ${msg}`);
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

    if (!this.sendEmails) {
      this.logger.warn(`[DEV-EMAIL OFF] To: ${to}`);
      this.logger.warn(`[DEV-EMAIL OFF] Subject: ${subject}`);
      this.logger.debug(`[DEV-EMAIL OFF] LINK: ${link}`);
      await this.safeLogUpdate({ id: log.id }, { attempt: 1, status: 'SENT' as EmailLogStatus });
      return;
    }

    await this.sendWithRetry(
      async () => {
        await this.resend!.emails.send({
          from: this.from,
          to,
          subject,
          html,
          text: `Establece tu contraseña: ${link}`,
        });
      },
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
      async () => {
        await this.resend!.emails.send({
          from: this.from,
          to,
          subject,
          html,
          text: `Restablece tu contraseña: ${link}`,
        });
      },
      log.id,
    );

    this.logger.log(`Email (reset) enviado a ${to}`);
  }

  // ===== Método genérico para envío simple (sin plantilla) =====
  async sendMail(options: { to: string; subject: string; text: string; html?: string }) {
    const { to, subject, text, html } = options;

    const log = await this.safeLogCreate({
      to,
      subject,
      template: 'raw',
      payload: { text, html },
      status: 'PENDING' as EmailLogStatus,
    });

    if (!this.sendEmails) {
      this.logger.warn(`[DEV-EMAIL OFF] To: ${to}`);
      this.logger.debug(`[DEV-EMAIL OFF] Subject: ${subject}`);
      this.logger.debug(`[DEV-EMAIL OFF] Text: ${text}`);
      await this.safeLogUpdate({ id: log.id }, { attempt: 1, status: 'SENT' as EmailLogStatus });
      return;
    }

    await this.sendWithRetry(
      async () => {
        await this.resend!.emails.send({
          from: this.from,
          to,
          subject,
          text,
          html,
        });
      },
      log.id,
    );

    this.logger.log(`Email (raw) enviado a ${to}`);
  }
}
