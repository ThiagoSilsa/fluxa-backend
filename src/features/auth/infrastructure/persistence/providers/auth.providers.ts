// NestJS
import { Provider } from '@nestjs/common';

// Repository
import { AUTH_REPOSITORY } from '../../../domain/repositories/auth.repository';

// TypeORM
import { AuthTypeormRepository } from '../typeorm/auth-typeorm.repository';

/**
 * Registro DI do `AuthRepository` (token → implementação TypeORM via
 * `useExisting` — AGENTS.md §4).
 */
export const authProviders: Provider[] = [
  AuthTypeormRepository,
  { provide: AUTH_REPOSITORY, useExisting: AuthTypeormRepository },
];
