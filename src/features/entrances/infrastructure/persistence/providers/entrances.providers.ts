// NestJS
import type { Provider } from '@nestjs/common';

// Repository
import { ENTRANCE_REPOSITORY } from '../../../domain/repositories/entrance.repository';

// Implementation
import { EntrancesTypeormRepository } from '../typeorm/entrances-typeorm.repository';

/**
 * Providers de DI da feature `entrances` — repositório e seu Symbol token.
 */
export const entrancesProviders: Provider[] = [
  EntrancesTypeormRepository,
  { provide: ENTRANCE_REPOSITORY, useExisting: EntrancesTypeormRepository },
];
