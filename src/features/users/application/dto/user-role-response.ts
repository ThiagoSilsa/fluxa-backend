/**
 * Cargo de um usuário no formato de resposta (nunca a entidade crua).
 */
export interface UserRoleResponse {
  /** Id do vínculo `user_role`. */
  userRoleId: string;
  /** Id do cargo. */
  roleId: string;
  /** Nome do cargo. */
  roleName: string;
  /** Cargo de administração (acesso total). */
  isAdmin: boolean;
  /** Se o cargo está ativo. */
  isActive: boolean;
}

/**
 * Cargos de um usuário na empresa da sessão.
 */
export interface ListUserRolesResponse {
  /** Id da pessoa. */
  userId: string;
  /** Cargos atribuídos ao usuário na empresa. */
  roles: UserRoleResponse[];
}
