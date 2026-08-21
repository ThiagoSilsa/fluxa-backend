/**
 * Entrada dos use cases que operam sobre o departamento padrão de um veículo
 * específico (detalhar, remover) — carrega apenas o id do veículo.
 */
export class GetVehicleDepartmentInputDto {
  constructor(
    /** Id do veículo. */
    readonly vehicleId: string,
  ) {}
}
