// Types
import type { UserRoleWithRoleEntity } from '../../domain/entities/user-role.entity';
import type { UserRoleResponse } from '../dto/user-role-response';

/**
 * Mapeia o vínculo `user_role` (com cargo) para o formato de resposta.
 *
 * @param entity Vínculo com dados do cargo.
 * @returns Resposta de cargo do usuário.
 */
export function toUserRoleResponse(
  entity: UserRoleWithRoleEntity,
): UserRoleResponse {
  return {
    userRoleId: entity.userRoleId,
    roleId: entity.roleId,
    roleName: entity.roleName,
    isAdmin: entity.roleIsAdmin,
    isActive: entity.roleIsActive,
  };
}
