/**
 * Entrada do use case de remoção de permissão de um cargo.
 */
export class RemovePermissionInputDto {
  constructor(
    /** Cargo (da empresa da sessão). */
    readonly roleId: string,
    /** Permissão a remover. */
    readonly permissionId: string,
  ) {}
}
