/**
 * Entrada dos use cases que operam sobre os motoristas de um veículo
 * (listar, remover) — carrega o id do veículo.
 */
export class ListVehicleDriversInputDto {
  constructor(
    /** Id do veículo. */
    readonly vehicleId: string,
  ) {}
}
