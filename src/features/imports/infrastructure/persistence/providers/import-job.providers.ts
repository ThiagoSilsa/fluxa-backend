// NestJS
import type { Provider } from '@nestjs/common';

// Repository
import { IMPORT_JOB_REPOSITORY } from '../../../domain/repositories/import-job.repository';

// Implementation
import { ImportsTypeormRepository } from '../typeorm/imports-typeorm.repository';

/**
 * Providers de DI da feature `imports` — repositório e seu Symbol token.
 */
export const importJobProviders: Provider[] = [
  ImportsTypeormRepository,
  { provide: IMPORT_JOB_REPOSITORY, useExisting: ImportsTypeormRepository },
];
