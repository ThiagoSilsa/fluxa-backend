// NestJS
import type { Provider } from '@nestjs/common';

// Repository
import { USER_REPOSITORY } from '../../../domain/repositories/user.repository';
import { USER_ROLE_REPOSITORY } from '../../../domain/repositories/user-role.repository';

// Implementations
import { UserRoleTypeormRepository } from '../typeorm/user-role-typeorm.repository';
import { UsersTypeormRepository } from '../typeorm/users-typeorm.repository';

/**
 * Providers de DI da feature `users` — repositórios e seus Symbol tokens.
 */
export const usersProviders: Provider[] = [
  UsersTypeormRepository,
  { provide: USER_REPOSITORY, useExisting: UsersTypeormRepository },
  UserRoleTypeormRepository,
  {
    provide: USER_ROLE_REPOSITORY,
    useExisting: UserRoleTypeormRepository,
  },
];
