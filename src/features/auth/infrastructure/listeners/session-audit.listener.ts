import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { UserCompanySwitchedEvent } from '../../application/events/user-company-switched.event';
import { UserLoggedInEvent } from '../../application/events/user-logged-in.event';

/**
 * Listener de eventos de sessão (ADR 0003).
 *
 * Por ora apenas registra os eventos no log — comprova a fiação do
 * desacoplamento (o login/troca não depende desta persistência). A
 * **persistência** (`audit_log`, ação `LOGIN`) chega com a migration `0007`
 * (auditoria).
 */
@Injectable()
export class SessionAuditListener {
  private readonly logger = new Logger(SessionAuditListener.name);

  /**
   * Registra o login bem-sucedido.
   *
   * @param event Dados da sessão iniciada.
   */
  @OnEvent(UserLoggedInEvent.eventName)
  public handleLoggedIn(event: UserLoggedInEvent): void {
    this.logger.log(
      `Sessão iniciada — user=${event.userId}, company=${event.companyId}, ` +
        `ip=${event.ipAddress ?? '-'}, userAgent=${event.userAgent ?? '-'}`,
    );
    // TODO: persistir em audit_log (ação LOGIN) quando a migration 0007 (auditoria) entrar.
  }

  /**
   * Registra a troca de empresa da sessão.
   *
   * @param event Dados da troca.
   */
  @OnEvent(UserCompanySwitchedEvent.eventName)
  public handleCompanySwitched(event: UserCompanySwitchedEvent): void {
    this.logger.log(
      `Troca de empresa — user=${event.userId}, ` +
        `${event.fromCompanyId} → ${event.toCompanyId}`,
    );
    // TODO: persistir em audit_log quando a migration 0007 (auditoria) entrar.
  }
}
