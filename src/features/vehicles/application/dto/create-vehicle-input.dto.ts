/**
 * Entrada do use case de criação de veículo (já validada pelo controller).
 */
export class CreateVehicleInputDto {
  constructor(
    /** Placa (normalizada via `normalizePlate`; validada no use case). */
    readonly plate: string,
    /** Id do tipo de veículo (ativo e da empresa da sessão). */
    readonly vehicleTypeId: string,
    /** Modelo (opcional). */
    readonly model?: string,
    /** Cor (opcional). */
    readonly color?: string,
    /** Observação (opcional). */
    readonly observation?: string,
    /** Livre acesso (default `false`; conceder exige `GRANT_FREE_PASS`). */
    readonly freePass: boolean = false,
    /** `isBlocked` é derivado — rejeitado quando enviado (400). */
    readonly isBlocked?: boolean,
  ) {}
}
