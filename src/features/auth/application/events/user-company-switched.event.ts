/**
 * Evento `user.company_switched` (ADR 0003) — troca de empresa da sessão.
 *
 * Emitido pelo `SwitchCompanyUseCase` ao emitir token novo para outra empresa
 * (sem repetir senha). Emissão não-bloqueante; persistência na auditoria
 * (`audit_log`, migration `0007`).
 */
export class UserCompanySwitchedEvent {
  /** Nome do evento no EventEmitter2. */
  static readonly eventName = 'user.company_switched';

  constructor(
    /** Id da pessoa (linha em `user`). */
    readonly userId: string,
    /** Empresa da sessão anterior. */
    readonly fromCompanyId: string,
    /** Empresa da nova sessão. */
    readonly toCompanyId: string,
  ) {}
}
