/**
 * Entrada do use case de atribuição de cargo a usuário (já validada).
 */
export class AssignRoleInputDto {
  constructor(
    /** Id da pessoa. */
    readonly userId: string,
    /** Id do cargo (da empresa da sessão). */
    readonly roleId: string,
  ) {}
}
