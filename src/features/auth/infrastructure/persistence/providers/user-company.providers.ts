import { Provider } from '@nestjs/common';
import { USER_COMPANY_REPOSITORY } from '../../../domain/repositories/user-company.repository';
import { UserCompanyTypeormRepository } from '../typeorm/user-company-typeorm.repository';

/**
 * Registro DI do `UserCompanyRepository` (token → implementação TypeORM via
 * `useExisting` — AGENTS.md §4).
 */
export const userCompanyProviders: Provider[] = [
  UserCompanyTypeormRepository,
  {
    provide: USER_COMPANY_REPOSITORY,
    useExisting: UserCompanyTypeormRepository,
  },
];
