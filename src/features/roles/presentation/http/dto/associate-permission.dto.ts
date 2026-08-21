// class-validator
import { Matches } from 'class-validator';

// Shared
import { UUID_ANY_VERSION_PATTERN } from '../../../../../shared/validators/uuid.pattern';

/**
 * Body de associação de permissão a cargo (apresentação).
 *
 * O `roleId` vem do route param; o body carrega apenas a permissão.
 */
export class AssociatePermissionDto {
  @Matches(UUID_ANY_VERSION_PATTERN)
  permissionId!: string;
}
