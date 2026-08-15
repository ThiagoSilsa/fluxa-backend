// Constants
import { UserType } from '../../../auth/domain/constants/user-type.constant';

// Types
import type { UserCompanyWithUserEntity } from '../../../auth/domain/repositories/user-company.repository';
import type { UserEntity } from '../../domain/entities/user.entity';
import type { CreateUserResponse, UserResponse } from '../dto/user-response';

/**
 * Mapeia pessoa + vínculo para o formato de resposta (listagem/detalhe).
 *
 * @param entity Pessoa + vínculo na empresa da sessão.
 * @returns Resposta de usuário.
 */
export function toUserResponse(
  entity: UserCompanyWithUserEntity,
): UserResponse {
  return {
    id: entity.userId,
    name: entity.name,
    email: entity.email,
    phone: entity.phone,
    document: entity.document,
    observation: entity.observation,
    photoUrl: entity.photoUrl,
    type: entity.type,
    isActive: entity.isActive,
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
): CreateUserResponse {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    phone: user.phone,
    document: user.document,
    observation: user.observation,
    photoUrl: user.photoUrl,
    type,
    isActive,
    createdUser,
  };
}
