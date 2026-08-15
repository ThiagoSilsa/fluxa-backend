// NestJS
import type { Provider } from '@nestjs/common';

// Repository
import { USER_REPOSITORY } from '../../../domain/repositories/user.repository';

// Implementation
import { UsersTypeormRepository } from '../typeorm/users-typeorm.repository';

/**
 * Providers de DI da feature `users` — repositório de pessoas e seu Symbol.
 */
export const usersProviders: Provider[] = [
  UsersTypeormRepository,
  { provide: USER_REPOSITORY, useExisting: UsersTypeormRepository },
];
