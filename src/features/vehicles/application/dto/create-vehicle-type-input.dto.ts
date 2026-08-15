/**
 * Entrada do use case de criação de tipo de veículo (já validada pelo
 * controller).
 */
export class CreateVehicleTypeInputDto {
  constructor(
    /** Código (normalizado via `normalizeCode`; único por empresa). */
    readonly code: string,
    /** Nome do tipo (ex.: `Frota`). */
    readonly name: string,
    /** Classificação "frota da empresa" (default `false`). */
    readonly isFleet: boolean = false,
    /** Descrição opcional. */
    readonly description?: string | null,
  ) {}
}
