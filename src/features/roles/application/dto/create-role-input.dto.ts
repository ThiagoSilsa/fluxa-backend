/**
 * Entrada do use case de criação de cargo (já validada pelo controller).
 */
export class CreateRoleInputDto {
  constructor(
    /** Nome do cargo (ex.: `Porteiro`). */
    readonly name: string,
    /** Descrição opcional. */
    readonly description?: string | null,
    /** `true` é rejeitado: cargos de administração são do sistema (ADR 0004). */
    readonly isAdmin?: boolean,
  ) {}
}
