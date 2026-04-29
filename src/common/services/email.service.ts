// src/common/services/email.service.ts
//
// EmailService — implementación con Resend (https://resend.com).
//
// Razón de la migración: el plan gratuito de Mailjet expiró tras los 30 días
// de prueba. Resend ofrece 3.000 correos/mes gratis, sin tarjeta, con un SDK
// más simple y mejor entregabilidad para correos transaccionales como los
// nuestros (welcome, reset-password, notificaciones a contadora/director).
//
// Las firmas públicas (sendWelcomeSetPasswordEmail, sendResetPasswordEmail,
// sendMail) NO cambian — el resto del backend sigue funcionando sin tocar
// una sola línea adicional.

import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Resend } from 'resend';
import { PrismaService } from '../../prisma/prisma.service';

type EmailLogStatus = 'PENDING' | 'RETRYING' | 'SENT' | 'FAILED';
const MAX_ATTEMPTS = 3;

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);

  /** Cliente Resend (undefined si la API key está vacía). */
  private resend?: Resend;

  // Config
  private readonly from: string;
  private readonly frontendUrl?: string;
  private readonly setPasswordPath: string;
  private readonly resetPasswordPath: string;
  private sendEmails: boolean;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {
    // Flag global de envío real
    this.sendEmails =
      (this.config.get<string>('SEND_EMAILS') ?? 'true').toLowerCase() === 'true';

    // Remitente. Resend exige que el dominio del email esté verificado en su
    // panel; mientras se verifica, se puede usar `onboarding@resend.dev`
    // (sandbox) que solo permite enviar al email del owner de la cuenta.
    this.from =
      this.config.get<string>('MAIL_FROM') ||
      'Fundecodes <onboarding@resend.dev>';

    // Frontend URLs (para construir links de set/reset password)
    this.frontendUrl =
      this.config.get<string>('PUBLIC_FRONTEND_URL') ||
      this.config.get<string>('FRONTEND_URL') ||
      undefined;

    this.setPasswordPath =
      this.config.get<string>('FRONTEND_SET_PASSWORD_PATH') || '/set-password';

    this.resetPasswordPath =
      this.config.get<string>('FRONTEND_RESET_PASSWORD_PATH') || '/reset-password';

    // === Inicializar Resend ===
    const apiKey = this.config.get<string>('RESEND_API_KEY');

    if (!apiKey) {
      this.logger.error(
        '[RESEND] RESEND_API_KEY vacía. Se simulará el envío (SEND_EMAILS=false forzado).',
      );
      this.sendEmails = false;
    } else {
      this.resend = new Resend(apiKey);
      this.logger.log('[RESEND] Cliente inicializado correctamente.');
    }
  }

  // ========= Accessor para Prisma tolerante =========
  private get db(): any {
    return this.prisma as any;
  }

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
      // si la tabla no existe, lo ignoramos
    }
  }

  // ========= Builder genérico de links =========
  private buildLinkWithPath(token: string, path: string) {
    if (!this.frontendUrl) {
      this.logger.error(
        'FRONTEND_URL/PUBLIC_FRONTEND_URL no está definido; usando ruta relativa',
      );
      const p = path.startsWith('/') ? path : `/${path}`;
      return `${p}?token=${encodeURIComponent(token)}`;
    }
    const base = this.frontendUrl.replace(/\/+$/, '');
    const p = path.startsWith('/') ? path : `/${path}`;
    return `${base}${p}?token=${encodeURIComponent(token)}`;
  }

  buildSetPasswordLink(token: string) {
    return this.buildLinkWithPath(token, this.setPasswordPath);
  }

  buildResetPasswordLink(token: string) {
    return this.buildLinkWithPath(token, this.resetPasswordPath);
  }

  // ========= Envío vía Resend =========
  private async resendSend(
    to: string,
    subject: string,
    text: string,
    html?: string,
  ) {
    if (!this.sendEmails) {
      this.logger.warn(
        `[DEV-EMAIL OFF] Simulando envío a ${to} — Asunto: ${subject}`,
      );
      this.logger.debug({ to, subject, text, html });
      return;
    }

    if (!this.resend) {
      throw new Error('Resend no inicializado (RESEND_API_KEY vacía).');
    }

    const result = await this.resend.emails.send({
      from: this.from,
      to: [to],
      subject,
      text,
      html: html || text,
    });

    // El SDK de Resend devuelve `{ data, error }` — manejamos ambos.
    if ((result as any).error) {
      const err = (result as any).error;
      const msg = err?.message ?? JSON.stringify(err);
      throw new Error(`RESEND error: ${msg}`);
    }

    this.logger.debug(
      `[RESEND] Enviado a ${to}. id=${(result as any)?.data?.id ?? '?'}`,
    );
  }

  // ========= Reintentos con backoff =========
  private async sendWithRetry(sendFn: () => Promise<void>, logId: number) {
    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      try {
        await this.safeLogUpdate(
          { id: logId },
          {
            attempt,
            status:
              attempt === 1
                ? ('PENDING' as EmailLogStatus)
                : ('RETRYING' as EmailLogStatus),
          },
        );

        await sendFn();

        await this.safeLogUpdate(
          { id: logId },
          { status: 'SENT' as EmailLogStatus },
        );
        return;
      } catch (err: any) {
        const msg =
          err?.response?.body
            ? JSON.stringify(err.response.body)
            : err?.message || String(err);

        await this.safeLogUpdate(
          { id: logId },
          {
            status:
              attempt < MAX_ATTEMPTS
                ? ('RETRYING' as EmailLogStatus)
                : ('FAILED' as EmailLogStatus),
            error: msg.slice(0, 1000),
          },
        );
        this.logger.warn(`[RESEND] intento ${attempt} falló: ${msg}`);

        if (attempt < MAX_ATTEMPTS) {
          await new Promise((r) =>
            setTimeout(r, 500 * Math.pow(2, attempt - 1)),
          );
        } else {
          throw new BadRequestException(`RESEND error: ${msg}`);
        }
      }
    }
  }

  // ========= Email de bienvenida =========
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

    await this.sendWithRetry(
      () =>
        this.resendSend(
          to,
          subject,
          `Establece tu contraseña: ${link}`,
          html,
        ),
      log.id,
    );

    this.logger.log(`Email (welcome) enviado a ${to}`);
  }

  // ========= Email de reset =========
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

    await this.sendWithRetry(
      () =>
        this.resendSend(
          to,
          subject,
          `Restablece tu contraseña: ${link}`,
          html,
        ),
      log.id,
    );

    this.logger.log(`Email (reset) enviado a ${to}`);
  }

  // ========= Envío genérico =========
  async sendMail(options: {
    to: string;
    subject: string;
    text: string;
    html?: string;
  }) {
    const { to, subject, text, html } = options;

    const log = await this.safeLogCreate({
      to,
      subject,
      template: 'raw',
      payload: { text, html },
      status: 'PENDING' as EmailLogStatus,
    });

    await this.sendWithRetry(
      () => this.resendSend(to, subject, text, html),
      log.id,
    );

    this.logger.log(`Email (raw) enviado a ${to}`);
  }
}
