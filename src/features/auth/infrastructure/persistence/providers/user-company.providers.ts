import { Provider } from '@nestjs/common';
import { USER_COMPANY_REPOSITORY } from '../../../domain/repositories/user-company.repository';
import { UserCompanyTypeormRepository } from '../typeorm/user-company-typeorm.repository';

/**
 * Registro DI do `UserCompanyRepository` (token → implementação TypeORM).
 */
export const userCompanyProviders: Provider[] = [
  { provide: USER_COMPANY_REPOSITORY, useClass: UserCompanyTypeormRepository },
];
