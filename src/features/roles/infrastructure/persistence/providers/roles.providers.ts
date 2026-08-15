// NestJS
import type { Provider } from '@nestjs/common';

// Repository
import { PERMISSION_REPOSITORY } from '../../../domain/repositories/permission.repository';
import { ROLE_REPOSITORY } from '../../../domain/repositories/role.repository';

// Implementations
import { PermissionsTypeormRepository } from '../typeorm/permissions-typeorm.repository';
import { RolesTypeormRepository } from '../typeorm/roles-typeorm.repository';

/**
 * Providers de DI da feature `roles` — repositórios e seus Symbol tokens.
 */
export const rolesProviders: Provider[] = [
  RolesTypeormRepository,
  { provide: ROLE_REPOSITORY, useExisting: RolesTypeormRepository },
  PermissionsTypeormRepository,
  { provide: PERMISSION_REPOSITORY, useExisting: PermissionsTypeormRepository },
];
