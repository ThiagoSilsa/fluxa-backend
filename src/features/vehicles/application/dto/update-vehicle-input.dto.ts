/**
 * Entrada do use case de atualização de veículo (já validada pelo controller)
 * — parcial: só os campos enviados mudam.
 */
export class UpdateVehicleInputDto {
  constructor(
    /** Id do veículo a atualizar. */
    readonly id: string,
    /** Nova placa (opcional; normalizada; 400 inválida / 409 em conflito). */
    readonly plate?: string,
    /** Novo modelo (opcional; `null` limpa). */
    readonly model?: string | null,
    /** Nova cor (opcional; `null` limpa). */
    readonly color?: string | null,
    /** Nova observação (opcional; `null` limpa). */
    readonly observation?: string | null,
    /** Novo livre acesso (opcional; conceder `true` exige `GRANT_FREE_PASS`). */
    readonly freePass?: boolean,
    /** Novo tipo de veículo (opcional; ativo e da empresa da sessão). */
    readonly vehicleTypeId?: string,
    /** Ativo/inativo (reativação via PATCH — ADR 0006 §2). */
    readonly isActive?: boolean,
    /** `isBlocked` é derivado — rejeitado quando enviado (400). */
    readonly isBlocked?: boolean,
  ) {}
}
