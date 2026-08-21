/**
 * Cargo atribuído a um usuário na empresa (`user_role`) com dados do cargo —
 * entidade de domínio da feature `users` (Fase 3).
 */
export interface UserRoleWithRoleEntity {
  /** Id do vínculo `user_role`. */
  userRoleId: string;
  /** Id da pessoa. */
  userId: string;
  /** Id do cargo. */
  roleId: string;
  /** Nome do cargo. */
  roleName: string;
  /** Se o cargo é de administração (`is_admin` — governança especial). */
  roleIsAdmin: boolean;
  /** Se o cargo está ativo. */
  roleIsActive: boolean;
  /** Data de criação do vínculo. */
  createdAt: Date;
}
