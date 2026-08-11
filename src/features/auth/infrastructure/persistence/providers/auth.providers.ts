import { Provider } from '@nestjs/common';
import { AUTH_REPOSITORY } from '../../../domain/repositories/auth.repository';
import { AuthTypeormRepository } from '../typeorm/auth-typeorm.repository';

/**
 * Registro DI do `AuthRepository` (token → implementação TypeORM).
 */
export const authProviders: Provider[] = [
  { provide: AUTH_REPOSITORY, useClass: AuthTypeormRepository },
];
