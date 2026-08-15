/**
 * Entrada do use case de atualização de tipo de veículo (já validada pelo
 * controller) — parcial: só os campos enviados mudam.
 */
export class UpdateVehicleTypeInputDto {
  constructor(
    /** Id do tipo a atualizar. */
    readonly id: string,
    /** Novo código (opcional; normalizado; 409 em conflito). */
    readonly code?: string,
    /** Novo nome (opcional). */
    readonly name?: string,
    /** Nova descrição (opcional; `null` limpa). */
    readonly description?: string | null,
    /** Nova classificação de frota (opcional). */
    readonly isFleet?: boolean,
    /** Ativo/inativo (reativação via PATCH — ADR 0006 §2). */
    readonly isActive?: boolean,
  ) {}
}
