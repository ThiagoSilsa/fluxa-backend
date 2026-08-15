/**
 * Entrada do use case de atualização de departamento (já validada pelo
 * controller) — parcial: só os campos enviados mudam.
 */
export class UpdateDepartmentInputDto {
  constructor(
    /** Id do departamento a atualizar. */
    readonly id: string,
    /** Novo nome (opcional). */
    readonly name?: string,
    /** Nova descrição (opcional; `null` limpa). */
    readonly description?: string | null,
    /** Nova quantidade de vagas (opcional; `>= 0`). */
    readonly parkingSpace?: number,
    /** Ativo/inativo (reativação via PATCH — ADR 0006 §2). */
    readonly isActive?: boolean,
  ) {}
}
