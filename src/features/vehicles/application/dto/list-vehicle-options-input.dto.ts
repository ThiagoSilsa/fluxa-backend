/**
 * Entrada do use case de opções de veículo (já validada pelo controller).
 *
 * Busca por placa (normalizada no repositório) ou modelo — mesmo
 * comportamento do seletor da tela de solicitações (ADR 0011 §4).
 */
export class ListVehicleOptionsInputDto {
  constructor(
    /** Busca parcial (case-insensitive) por placa ou modelo. */
    readonly search?: string,
    /** Quantidade de registros por página. */
    readonly limit: number = 20,
    /** Offset da página. */
    readonly offset: number = 0,
  ) {}
}
