/**
 * Entrada do use case de revogação de bloqueio.
 */
export class RevokeBlockInputDto {
  constructor(
    /** Id do bloqueio. */
    readonly blockId: string,
    /** Motivo da revogação (obrigatório). */
    readonly reason: string,
  ) {}
}
