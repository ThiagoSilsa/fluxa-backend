/**
 * Entrada do use case de listagem de veículos (já validada pelo controller).
 */
export class ListVehiclesInputDto {
  constructor(
    /** Busca por placa (normalizada) ou trecho de modelo. */
    readonly search?: string,
    /** Filtro por tipo de veículo. */
    readonly vehicleTypeId?: string,
    /** Filtro por departamento padrão. */
    readonly departmentId?: string,
    /** Filtro por livre acesso. */
    readonly freePass?: boolean,
    /** Filtro por estado ativo/inativo. */
    readonly isActive?: boolean,
    /** Quantidade de registros por página. */
    readonly limit: number = 20,
    /** Offset da página. */
    readonly offset: number = 0,
  ) {}
}
