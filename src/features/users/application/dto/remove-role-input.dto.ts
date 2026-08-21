/**
 * Entrada do use case de remoção de cargo de usuário (já validada).
 */
export class RemoveRoleInputDto {
  constructor(
    /** Id da pessoa. */
    readonly userId: string,
    /** Id do cargo (da empresa da sessão). */
    readonly roleId: string,
  ) {}
}
