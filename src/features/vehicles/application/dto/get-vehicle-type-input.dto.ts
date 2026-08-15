/**
 * Entrada dos use cases que operam sobre um tipo de veículo específico
 * (detalhar, desativar) — carrega apenas o id.
 */
export class GetVehicleTypeInputDto {
  constructor(
    /** Id do tipo de veículo. */
    readonly id: string,
  ) {}
}
