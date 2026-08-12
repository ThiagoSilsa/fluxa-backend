/**
 * Evento `user.logged_in` (ADR 0003) — sessão autenticada com sucesso.
 *
 * Emitido pelo `LoginUseCase` (e pelo `SwitchCompanyUseCase`, que registra a
 * nova sessão). A emissão é **não-bloqueante** (`EventEmitter2.emit`); a
 * persistência fica para a auditoria (`audit_log`, migration `0007`).
 */
export class UserLoggedInEvent {
  /** Nome do evento no EventEmitter2. */
  static readonly eventName = 'user.logged_in';

  constructor(
    /** Id da pessoa (linha em `user`). */
    readonly userId: string,
    /** Empresa da sessão. */
    readonly companyId: string,
    /** IP de origem (ADR 0003 — contexto de sessão). */
    readonly ipAddress?: string,
    /** User-Agent de origem (ADR 0003 — contexto de sessão). */
    readonly userAgent?: string,
  ) {}
}
