/**
 * Entrada do use case de listagem de cargos de usuário (já validada).
 */
export class ListUserRolesInputDto {
  constructor(
    /** Id da pessoa. */
    readonly userId: string,
  ) {}
}
