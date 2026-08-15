/**
 * Entrada do use case de listagem de departamentos (já validada pelo
 * controller).
 */
export class ListDepartmentsInputDto {
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
