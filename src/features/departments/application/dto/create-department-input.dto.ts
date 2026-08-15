/**
 * Entrada do use case de criação de departamento (já validada pelo
 * controller).
 */
export class CreateDepartmentInputDto {
  constructor(
    /** Nome do departamento (ex.: `Recepção`). */
    readonly name: string,
    /** Quantidade de vagas (obrigatória; `0` = sem vagas — ADR 0006 §7). */
    readonly parkingSpace: number,
    /** Descrição opcional. */
    readonly description?: string | null,
  ) {}
}
