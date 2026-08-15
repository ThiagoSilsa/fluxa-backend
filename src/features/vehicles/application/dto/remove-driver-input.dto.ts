/**
 * Entrada do use case de remoção de motorista do veículo — carrega o id do
 * veículo e do motorista.
 */
export class RemoveDriverInputDto {
  constructor(
    /** Id do veículo. */
    readonly vehicleId: string,
    /** Id do motorista. */
    readonly userId: string,
  ) {}
}
