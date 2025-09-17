import { Injectable, Logger } from '@nestjs/common';
import { TokenService } from './token.service';
import { EmailService } from './email.service';

@Injectable()
export class WelcomeFlowService {
  private readonly logger = new Logger(WelcomeFlowService.name);
  private readonly isDev =
    (process.env.NODE_ENV || 'development') !== 'production';
  private readonly baseUrl =
    process.env.FRONTEND_URL || 'http://localhost:3000';
  private readonly setPasswordPath =
    process.env.FRONTEND_SET_PASSWORD_PATH || '/set-password';

  constructor(
    private readonly tokens: TokenService,
    private readonly email: EmailService,
  ) {}

  /**
   * Dispara el flujo tras crear un colaborador:
   * - Genera token (30 min)
   * - Construye link hacia el front
   * - En dev: loguea token y link para pruebas
   * - Envía email (con reintentos) y registra auditoría en EmailLog
   */
  async onCollaboratorCreated(user: {
    id: number;
    correo: string;
    nombreCompleto?: string | null;
  }) {
    const token = this.tokens.generateSetPasswordToken({
      id: user.id,
      email: user.correo,
    });

    // Normaliza la ruta, evita dobles slashes
    const path = this.setPasswordPath.startsWith('/')
      ? this.setPasswordPath
      : `/${this.setPasswordPath}`;
    const link = `${this.baseUrl}${path}?token=${encodeURIComponent(token)}`;

    if (this.isDev) {
      this.logger.warn(`[DEV] set-password token for ${user.correo}:`);
      this.logger.debug(token);
      this.logger.warn(`[DEV] link: ${link}`);
    }

    try {
      await this.email.sendWelcomeSetPasswordEmail(user.correo, link);
      this.logger.log(`Welcome email encolado/enviado a ${user.correo}`);
    } catch (err: any) {
      // EmailService ya hace reintentos y registra en EmailLog;
      // aquí solo dejamos trazabilidad adicional.
      this.logger.error(
        `Fallo al enviar welcome email a ${user.correo}: ${err?.message || err}`,
      );
      throw err;
    }
  }
}
