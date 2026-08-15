/**
 * Entrada dos use cases que operam sobre um veículo específico (detalhar,
 * desativar) — carrega apenas o id.
 */
export class GetVehicleInputDto {
  constructor(
    /** Id do veículo. */
    readonly id: string,
  ) {}
}
