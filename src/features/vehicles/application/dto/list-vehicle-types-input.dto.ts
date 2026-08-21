/**
 * Entrada do use case de listagem de tipos de veículo (já validada pelo
 * controller).
 */
export class ListVehicleTypesInputDto {
  constructor(
    /** Busca por código ou nome (parcial, case-insensitive). */
    readonly search?: string,
    /** Filtro pela classificação de frota. */
    readonly isFleet?: boolean,
    /** Filtro por estado ativo/inativo. */
    readonly isActive?: boolean,
    /** Quantidade de registros por página. */
    readonly limit: number = 20,
    /** Offset da página. */
    readonly offset: number = 0,
  ) {}
}
