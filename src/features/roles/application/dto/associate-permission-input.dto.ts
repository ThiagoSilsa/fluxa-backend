/**
 * Entrada do use case de associação de permissão ao cargo.
 */
export class AssociatePermissionInputDto {
  constructor(
    /** Cargo (da empresa da sessão). */
    readonly roleId: string,
    /** Permissão do catálogo global. */
    readonly permissionId: string,
  ) {}
}
