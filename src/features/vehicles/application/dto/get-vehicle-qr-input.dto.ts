/**
 * Entrada dos use cases de QR que operam sobre um veículo específico (emitir,
 * reimprimir, reemitir, revogar) — carrega apenas o id do veículo.
 */
export class GetVehicleQrInputDto {
  constructor(
    /** Id do veículo. */
    readonly vehicleId: string,
  ) {}
}
