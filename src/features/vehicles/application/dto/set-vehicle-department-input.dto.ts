/**
 * Entrada do use case de definição do departamento padrão do veículo (PUT —
 * upsert na linha única, ADR 0006 §8).
 */
export class SetVehicleDepartmentInputDto {
  constructor(
    /** Id do veículo. */
    readonly vehicleId: string,
    /** Departamento padrão (ativo e da empresa da sessão). */
    readonly departmentId: string,
  ) {}
}
