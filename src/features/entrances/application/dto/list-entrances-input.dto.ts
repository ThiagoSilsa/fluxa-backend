/**
 * Entrada do use case de listagem de portarias (já validada pelo controller).
 */
export class ListEntrancesInputDto {
  constructor(
    /** Busca por nome (parcial, case-insensitive). */
    readonly search?: string,
    /** Filtro por estado ativo/inativo. */
    readonly isActive?: boolean,
    /** Quantidade de registros por página. */
    readonly limit: number = 20,
    /** Offset da página. */
    readonly offset: number = 0,
  ) {}
}
