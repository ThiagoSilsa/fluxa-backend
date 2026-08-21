/**
 * Entrada do use case de atualização de dispositivo (já validada pelo
 * controller) — parcial: só os campos enviados mudam.
 *
 * `entranceId?: string | null` — `undefined` não altera o vínculo; `null`
 * desvincula a portaria (ADR 0008 §4).
 */
export class UpdateDeviceInputDto {
  constructor(
    /** Id do dispositivo a atualizar. */
    readonly id: string,
    /** Novo nome (opcional). */
    readonly name?: string,
    /** Vínculo com portaria: id, `null` para desvincular, `undefined` não altera. */
    readonly entranceId?: string | null,
    /** Ativo/inativo (desativação suspende o token — ADR 0008 §6). */
    readonly isActive?: boolean,
  ) {}
}
