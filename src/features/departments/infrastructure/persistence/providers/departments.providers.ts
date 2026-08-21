// NestJS
import type { Provider } from '@nestjs/common';

// Repository
import { DEPARTMENT_REPOSITORY } from '../../../domain/repositories/department.repository';

// Implementation
import { DepartmentsTypeormRepository } from '../typeorm/departments-typeorm.repository';

/**
 * Providers de DI da feature `departments` — repositório e seu Symbol token.
 */
export const departmentsProviders: Provider[] = [
  DepartmentsTypeormRepository,
  { provide: DEPARTMENT_REPOSITORY, useExisting: DepartmentsTypeormRepository },
];
