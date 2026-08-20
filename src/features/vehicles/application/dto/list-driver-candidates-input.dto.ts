/**
 * Entrada do use case de candidatos a motorista (já validada pelo controller).
 */
export class ListDriverCandidatesInputDto {
  constructor(
    /** Busca por nome (parcial, case-insensitive). */
    readonly search?: string,
    /** Quantidade de registros por página. */
    readonly limit: number = 20,
    /** Offset da página. */
    readonly offset: number = 0,
  ) {}
}
