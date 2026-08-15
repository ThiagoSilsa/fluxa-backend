/**
 * Entrada do use case de atualização de cargo (já validada pelo controller).
 *
 * `isAdmin` não é alterável pelo CRUD — cargos de administração são imutáveis
 * (ADR 0004); o DTO sequer o carrega.
 */
export class UpdateRoleInputDto {
  constructor(
    /** Id do cargo a atualizar. */
    readonly id: string,
    /** Novo nome (opcional). */
    readonly name?: string,
    /** Nova descrição (opcional; `null` limpa). */
    readonly description?: string | null,
  ) {}
}
