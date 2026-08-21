// class-validator
import { Matches } from 'class-validator';

// Shared
import { UUID_ANY_VERSION_PATTERN } from '../../../../../shared/validators/uuid.pattern';

/**
 * Body de atribuição de cargo a usuário (apresentação).
 */
export class AssignRoleDto {
  @Matches(UUID_ANY_VERSION_PATTERN)
  roleId!: string;
}
