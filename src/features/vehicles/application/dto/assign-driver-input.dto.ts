/**
 * Entrada do use case de atribuição de motorista a veículo (já validada pelo
 * controller).
 */
export class AssignDriverInputDto {
  constructor(
    /** Id do veículo. */
    readonly vehicleId: string,
    /** Id do motorista (com vínculo ativo na empresa da sessão). */
    readonly userId: string,
    /** Proprietário principal (default `false`; 1 por veículo). */
    readonly isPrimary: boolean = false,
    /** Autorizado a dirigir (default `true`). */
    readonly canDrive: boolean = true,
  ) {}
}
