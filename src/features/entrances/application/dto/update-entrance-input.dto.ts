/**
 * Entrada do use case de atualização de portaria (já validada pelo
 * controller) — parcial: só os campos enviados mudam.
 */
export class UpdateEntranceInputDto {
  constructor(
    /** Id da portaria a atualizar. */
    readonly id: string,
    /** Novo nome (opcional). */
    readonly name?: string,
    /** Ativo/inativo (reativação via PATCH — ADR 0006 §2). */
    readonly isActive?: boolean,
  ) {}
}
