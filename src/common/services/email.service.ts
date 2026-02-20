// src/common/services/email.service.ts
import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Mailjet from 'node-mailjet';
import { PrismaService } from '../../prisma/prisma.service';

type EmailLogStatus = 'PENDING' | 'RETRYING' | 'SENT' | 'FAILED';
const MAX_ATTEMPTS = 3;

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);

  // Cliente Mailjet (tipado como any para evitar broncas de TS)
  private mailjet?: any;

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

    // Remitente
    this.from =
      this.config.get<string>('MAIL_FROM') ||
      'Fundecodes <no-reply@test.com>';

    // Frontend URLs
    this.frontendUrl =
      this.config.get<string>('PUBLIC_FRONTEND_URL') ||
      this.config.get<string>('FRONTEND_URL') ||
      undefined;

    this.setPasswordPath =
      this.config.get<string>('FRONTEND_SET_PASSWORD_PATH') || '/set-password';

    this.resetPasswordPath =
      this.config.get<string>('FRONTEND_RESET_PASSWORD_PATH') || '/reset-password';

    // === Inicializar Mailjet usando el constructor ===
    const apiKey = this.config.get<string>('MAILJET_API_KEY');
    const secretKey = this.config.get<string>('MAILJET_SECRET_KEY');

    if (!apiKey || !secretKey) {
      this.logger.error(
        '[MAILJET] MAILJET_API_KEY o MAILJET_SECRET_KEY vacíos. Se simulará el envío.',
      );
      this.sendEmails = false;
    } else {
      // Mailjet es una clase; la instanciamos con apiKey / apiSecret
      this.mailjet = new (Mailjet as any)({
        apiKey,
        apiSecret: secretKey,
      });
      this.logger.log('[MAILJET] Cliente inicializado correctamente');
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

  // ========= Envío vía Mailjet =========
  private async mailjetSend(
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

    if (!this.mailjet) {
      throw new Error('Mailjet no inicializado');
    }

    // parsear "Nombre <correo@x.com>"
    const emailMatch = this.from.match(/<(.+)>/);
    const nameMatch = this.from.match(/^(.*?)</);

    const fromEmail = emailMatch?.[1]?.trim() || this.from;
    const fromName = nameMatch?.[1]?.trim() || 'Fundecodes';

    const res = await this.mailjet.post('send', { version: 'v3.1' }).request({
      Messages: [
        {
          From: {
            Email: fromEmail,
            Name: fromName,
          },
          To: [{ Email: to }],
          Subject: subject,
          TextPart: text,
          HTMLPart: html || text,
        },
      ],
    });

    // 🔍 Debug de la respuesta de Mailjet
    this.logger.debug(
      `MAILJET RES: ${JSON.stringify(res.body ?? res, null, 2)}`,
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
        this.logger.warn(`[MAILJET] intento ${attempt} falló: ${msg}`);

        if (attempt < MAX_ATTEMPTS) {
          await new Promise((r) =>
            setTimeout(r, 500 * Math.pow(2, attempt - 1)),
          );
        } else {
          throw new BadRequestException(`MAILJET error: ${msg}`);
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
      () => this.mailjetSend(to, subject, `Establece tu contraseña: ${link}`, html),
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
      () => this.mailjetSend(to, subject, `Restablece tu contraseña: ${link}`, html),
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
      () => this.mailjetSend(to, subject, text, html),
      log.id,
    );

    this.logger.log(`Email (raw) enviado a ${to}`);
  }
}
