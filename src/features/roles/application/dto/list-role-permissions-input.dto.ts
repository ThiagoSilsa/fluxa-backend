/**
 * Entrada do use case de listagem das permissões de um cargo.
 */
export class ListRolePermissionsInputDto {
  constructor(
    /** Cargo (da empresa da sessão). */
    readonly roleId: string,
  ) {}
}
