/**
 * Entrada do use case de listagem de cargos (já validada pelo controller).
 */
export class ListRolesInputDto {
  constructor(
    /** Busca por nome (parcial, case-insensitive). */
    readonly search?: string,
    /** Quantidade de registros por página. */
    readonly limit: number = 20,
    /** Offset da página. */
    readonly offset: number = 0,
    /** Filtro por status ativo/inativo (opcional). */
    readonly isActive?: boolean,
  ) {}
}
