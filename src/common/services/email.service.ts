// src/common/services/email.service.ts
import { Injectable, Logger } from '@nestjs/common';
import * as sg from '@sendgrid/mail';
import { PrismaService } from '../../prisma/prisma.service';

const MAX_ATTEMPTS = 3;

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private readonly from =
    process.env.MAIL_FROM || 'Fundecodes <no-reply@fundecodes.org>';
  private readonly isDummy: boolean;

  constructor(private readonly prisma: PrismaService) {
    const apiKey = process.env.SENDGRID_API_KEY || '';
    this.isDummy = !apiKey || apiKey.trim().toLowerCase().startsWith('dummy');

    if (this.isDummy) {
      this.logger.warn(
        'SENDGRID_API_KEY no configurada o dummy; se simularán envíos de email (DEV MODE).',
      );
    } else {
      sg.setApiKey(apiKey);
    }
  }

  // Acceso laxo por si los tipos de Prisma aún no reflejan EmailLog
  private get db(): any {
    return this.prisma as any;
  }

  async sendWelcomeSetPasswordEmail(to: string, link: string) {
    const subject = 'Bienvenido(a) a FUNDECODES — Establece tu contraseña';
    const html = `
      <p>¡Hola!</p>
      <p>Has sido registrado como colaborador en FUNDECODES.</p>
      <p>Para establecer tu contraseña definitiva, sigue este enlace (vigente 30 minutos):</p>
      <p><a href="${link}" target="_blank" rel="noopener">Establecer contraseña</a></p>
      <p>Si no solicitaste este registro, ignora este mensaje.</p>
    `;

    const log = await this.db.emailLog.create({
      data: {
        to,
        subject,
        template: 'welcome-set-password',
        payload: { link },
        status: 'PENDING',
      },
    });

    if (this.isDummy) {
      // 🔸 DEV MODE: no enviamos, solo registramos y mostramos en consola
      this.logger.warn(`[DEV-EMAIL] To: ${to}`);
      this.logger.warn(`[DEV-EMAIL] Subject: ${subject}`);
      this.logger.debug(`[DEV-EMAIL] HTML:\n${html}`);

      await this.db.emailLog.update({
        where: { id: log.id },
        data: { attempt: 1, status: 'SENT' },
      });
      return;
    }

    // Producción: enviar con reintentos
    await this.sendWithRetry(log.id, {
      to,
      subject,
      html,
      text: `Establece tu contraseña: ${link}`,
    });
  }

  private async sendWithRetry(
    logId: number,
    msg: { to: string; subject: string; html: string; text?: string },
  ) {
    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      try {
        await this.db.emailLog.update({
          where: { id: logId },
          data: { attempt, status: attempt === 1 ? 'PENDING' : 'RETRYING' },
        });

        await sg.send({
          to: msg.to,
          from: this.from,
          subject: msg.subject,
          html: msg.html,
          text: msg.text,
        });

        await this.db.emailLog.update({
          where: { id: logId },
          data: { status: 'SENT' },
        });
        this.logger.log(`Email enviado a ${msg.to}`);
        return;
      } catch (err: any) {
        const errStr =
          (err?.response?.body
            ? JSON.stringify(err.response.body)
            : err?.message) || String(err);
        await this.db.emailLog.update({
          where: { id: logId },
          data: {
            status: attempt < MAX_ATTEMPTS ? 'RETRYING' : 'FAILED',
            error: errStr.slice(0, 1000),
          },
        });
        this.logger.warn(`Intento ${attempt} falló para ${msg.to}: ${errStr}`);

        if (attempt < MAX_ATTEMPTS) {
          // backoff exponencial simple: 500ms, 1000ms, 2000ms...
          await new Promise((r) =>
            setTimeout(r, 500 * Math.pow(2, attempt - 1)),
          );
        } else {
          this.logger.error(`Email a ${msg.to} falló tras ${attempt} intentos`);
        }
      }
    }
  }
}
