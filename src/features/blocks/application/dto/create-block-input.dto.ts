/**
 * Entrada do use case de criação de bloqueio (já validada pelo controller).
 */
export class CreateBlockInputDto {
  constructor(
    /** Placa (normalizada na validação). */
    readonly plate: string,
    /** Motivo (obrigatório — exibido ao porteiro). */
    readonly reason: string,
  ) {}
}
