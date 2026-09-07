/**
 * Entrada dos use cases que operam sobre uma solicitação específica sem
 * resolução (rejeitar, cancelar, marcar em contato) — carrega o id e a
 * observação opcional.
 */
export class HandleAccessRequestInputDto {
  constructor(
    /** Id da solicitação. */
    readonly requestId: string,
    /** Observação da avaliação (opcional). */
    readonly observation?: string,
  ) {}
}
