/**
 * Entrada do use case de atualização do vínculo motorista ↔ veículo (já
 * validada pelo controller) — parcial: só os campos enviados mudam.
 */
export class UpdateDriverInputDto {
  constructor(
    /** Id do veículo. */
    readonly vehicleId: string,
    /** Id do motorista. */
    readonly userId: string,
    /** Novo estado de proprietário principal (opcional). */
    readonly isPrimary?: boolean,
    /** Nova autorização para dirigir (opcional). */
    readonly canDrive?: boolean,
  ) {}
}
