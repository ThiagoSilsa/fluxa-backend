/**
 * Entrada do use case de remoção do departamento padrão do veículo — carrega
 * apenas o id do veículo.
 */
export class RemoveVehicleDepartmentInputDto {
  constructor(
    /** Id do veículo. */
    readonly vehicleId: string,
  ) {}
}
