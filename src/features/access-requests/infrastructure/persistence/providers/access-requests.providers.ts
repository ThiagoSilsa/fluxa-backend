// NestJS
import type { Provider } from '@nestjs/common';

// Repositories
import { ACCESS_REQUEST_REPOSITORY } from '../../../domain/repositories/access-request.repository';

// Implementations
import { AccessRequestsTypeormRepository } from '../typeorm/access-requests-typeorm.repository';

/**
 * Providers de DI da feature `access-requests` — repositório e seu Symbol
 * token.
 */
export const accessRequestsProviders: Provider[] = [
  AccessRequestsTypeormRepository,
  {
    provide: ACCESS_REQUEST_REPOSITORY,
    useExisting: AccessRequestsTypeormRepository,
  },
];
