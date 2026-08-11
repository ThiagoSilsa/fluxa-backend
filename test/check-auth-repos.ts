import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import {
  AuthRepository,
  AUTH_REPOSITORY,
} from '../src/features/auth/domain/repositories/auth.repository';
import {
  UserCompanyRepository,
  USER_COMPANY_REPOSITORY,
} from '../src/features/auth/domain/repositories/user-company.repository';

/**
 * Verificação da Fase 2 — exercita os repositórios de auth contra o banco de
 * desenvolvimento (dev DB via .env):
 *
 * - AuthRepository: findUsersByEmail, findUserInCompany, roles, permissions;
 * - UserCompanyRepository: findActiveByUserId, existsActive, countActiveByUserId.
 *
 * Uso: npx ts-node test/check-auth-repos.ts
 */
async function main(): Promise<void> {
  const app = await NestFactory.createApplicationContext(AppModule);
  try {
    const authRepo = app.get<AuthRepository>(AUTH_REPOSITORY);
    const userCompanyRepo = app.get<UserCompanyRepository>(
      USER_COMPANY_REPOSITORY,
    );

    const candidates = await authRepo.findUsersByEmail('admin@somar.local');
    console.log('[1] findUsersByEmail →', candidates.length, 'candidato(s)');
    console.log('    ', JSON.stringify(candidates));

    if (candidates[0]) {
      const { id, companyId } = candidates[0];

      const inCompany = await authRepo.findUserInCompany(id, companyId);
      console.log('[2] findUserInCompany →', JSON.stringify(inCompany));

      const roles = await authRepo.findRoleCodesByUserIdAndCompanyId(
        id,
        companyId,
      );
      console.log('[3] roles →', JSON.stringify(roles));

      const permissions = await authRepo.findPermissionsByUserIdAndCompanyId(
        id,
        companyId,
      );
      console.log('[4] permissions →', JSON.stringify(permissions));

      const activeCompanies = await userCompanyRepo.findActiveByUserId(id);
      console.log('[5] findActiveByUserId →', JSON.stringify(activeCompanies));

      console.log(
        '[6] existsActive(empresa correta) →',
        await userCompanyRepo.existsActive(id, companyId),
      );
      console.log(
        '[7] existsActive(empresa inexistente) →',
        await userCompanyRepo.existsActive(
          id,
          '00000000-0000-0000-0000-000000000000',
        ),
      );
      console.log(
        '[8] countActiveByUserId →',
        await userCompanyRepo.countActiveByUserId(id),
      );
    }

    console.log('\nFase 2 OK — repositórios respondendo contra o banco real.');
  } finally {
    await app.close();
  }
}

main().catch((error: unknown) => {
  console.error('[check-auth-repos] Falhou:', error);
  process.exit(1);
});
