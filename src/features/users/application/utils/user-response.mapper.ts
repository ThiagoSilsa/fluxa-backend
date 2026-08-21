// Constants
import { UserType } from '../../../auth/domain/constants/user-type.constant';

// Types
import type { UserCompanyWithUserEntity } from '../../../auth/domain/repositories/user-company.repository';
import type { UserEntity } from '../../domain/entities/user.entity';
import type { UserRoleWithRoleEntity } from '../../domain/entities/user-role.entity';
import type {
  CreateUserResponse,
  UserResponse,
  UserRoleSummaryResponse,
} from '../dto/user-response';

/**
 * Converte um vínculo `user_role` (com dados do cargo) no resumo de resposta.
 *
 * @param role Vínculo com dados do cargo.
 * @returns Resumo do cargo.
 */
export function toRoleSummary(
  role: UserRoleWithRoleEntity,
): UserRoleSummaryResponse {
  return {
    userRoleId: role.userRoleId,
    roleId: role.roleId,
    roleName: role.roleName,
    isAdmin: role.roleIsAdmin,
  };
}

/**
 * Mapeia pessoa + vínculo para o formato de resposta (listagem/detalhe).
 *
 * @param entity Pessoa + vínculo na empresa da sessão.
 * @param role Vínculo `user_role` do usuário (opcional — enriquecido pelo
 * caller; `null` quando o usuário não tem cargo).
 * @returns Resposta de usuário.
 */
export function toUserResponse(
  entity: UserCompanyWithUserEntity,
  role: UserRoleWithRoleEntity | null = null,
): UserResponse {
  return {
    id: entity.userId,
    name: entity.name,
    email: entity.email,
    phone: entity.phone,
    document: entity.document,
    photoUrl: entity.photoUrl,
    type: entity.type,
    isActive: entity.isActive,
    role: role ? toRoleSummary(role) : null,
  };
}

/**
 * Monta a resposta de criação de usuário a partir da pessoa criada/vinculada
 * e dos dados do vínculo (ADR 0005 §2).
 *
 * @param user Pessoa (criada ou já existente).
 * @param type Tipo no vínculo criado.
 * @param isActive Vínculo ativo na criação.
 * @param createdUser `true` se a pessoa foi criada; `false` se era vínculo.
 * @returns Resposta de criação.
 */
export function toCreatedUserResponse(
  user: UserEntity,
  type: UserType,
  isActive: boolean,
  createdUser: boolean,
  role: UserRoleWithRoleEntity | null = null,
): CreateUserResponse {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    phone: user.phone,
    document: user.document,
    photoUrl: user.photoUrl,
    type,
    isActive,
    role: role ? toRoleSummary(role) : null,
    createdUser,
  };
}
