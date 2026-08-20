// NestJS
import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { DataSource } from 'typeorm';

// App
import { AppModule } from '../../../../../app.module';

// Migrations
import { CreateInitialMultiTenantRbacSchema1760000000000 } from '../../../../../shared/database/typeorm/migrations/0001-create-initial-multi-tenant-rbac-schema';
import { CreateVehicleCatalogSchema1760000000001 } from '../../../../../shared/database/typeorm/migrations/0002-create-vehicle-catalog-schema';
import { CreateAccessAndBlockSchema1760000000002 } from '../../../../../shared/database/typeorm/migrations/0003-create-access-and-block-schema';
import { CreateMovementAndOccupancySchema1760000000003 } from '../../../../../shared/database/typeorm/migrations/0004-create-movement-and-occupancy-schema';
import { CreateRequestDeviceImportSchema1760000000004 } from '../../../../../shared/database/typeorm/migrations/0005-create-request-device-import-schema';
import { CreateUserCompanySchema1760000000005 } from '../../../../../shared/database/typeorm/migrations/0006-create-user-company-schema';
import { AddLastLoginAtToUser1760000000007 } from '../../../../../shared/database/typeorm/migrations/0008-add-last-login-at-to-user';
import { UniqueUserRolePerUserCompany1760000000008 } from '../../../../../shared/database/typeorm/migrations/0009-unique-user-role-per-user-company';
import { DropUserObservation1760000000009 } from '../../../../../shared/database/typeorm/migrations/0010-drop-user-observation';
import { AdaptImportJobSchema1760000000010 } from '../../../../../shared/database/typeorm/migrations/0011-adapt-import-job-schema';

// Seeds
import { SeedInitialPermissions1760001000000 } from '../../../../../shared/database/typeorm/seeds/0001-seed-initial-permissions';
import { SeedDefaultCompanyRolesAdminVehicleTypes1760001000001 } from '../../../../../shared/database/typeorm/seeds/0002-seed-default-company-roles-admin-vehicle-types';

// Test support
import { createLoginAndGetToken } from '../../../../../test/support/login-and-get-token';
import { PostgresTestContainer } from '../../../../../test/support/postgres-test-container';
import { RedisTestContainer } from '../../../../../test/support/redis-test-container';
import { resetThrottle } from '../../../../../test/support/reset-throttle';

// Auth (dados seedados compartilhados)
import { AUTH_SEEDED } from '../../../../auth/tests/integration/support/auth-integration-context';

/**
 * IDs e credenciais usados pelos testes de integração dos importadores de
 * veículos e de vínculo usuário-veículo.
 */
export const VEHICLES_IMPORT_SEEDED = {
  SOMAR_COMPANY_ID: AUTH_SEEDED.SOMAR_COMPANY_ID,
  ADMIN_EMAIL: AUTH_SEEDED.ADMIN_EMAIL,
  ADMIN_PASSWORD: AUTH_SEEDED.ADMIN_PASSWORD,
  /** Cargo `Porteiro` (sem MANAGE_IMPORTS). */
  PORTEIRO_ROLE_ID: '20000000-0000-0000-0000-000000000004',
} as const;

/** Status do job após o processamento (para o helper de polling). */
export interface JobPollResult {
  status: 'PENDING' | 'PROCESSING' | 'DONE' | 'FAILED';
  errorMessage: string | null;
  successCount: number;
  errorCount: number;
}

/** Contexto de integração dos importadores de veículos. */
export interface VehiclesImportIntegrationContext {
  app: INestApplication;
  httpServer: Parameters<typeof request>[0];
  dataSource: DataSource;
  loginAndGetToken: (email: string, password: string) => Promise<string>;
  resetThrottle: () => void;
  seedUserWithRole: (email: string, roleId: string) => Promise<void>;
  pollJobUntilFinished: (
    jobId: string,
    token: string,
    timeoutMs?: number,
  ) => Promise<JobPollResult>;
  close: () => Promise<void>;
}

/**
 * Monta o app de integração dos importadores de veículos — Postgres e Redis
 * via Testcontainers + migrations/seeds do zero + `AppModule` + HTTP.
 */
export async function createVehiclesImportIntegrationContext(): Promise<VehiclesImportIntegrationContext> {
  const postgres = new PostgresTestContainer();
  await postgres.start();

  const redis = new RedisTestContainer();
  await redis.start();

  process.env.JWT_SECRET = 'integration-test-secret';
  process.env.JWT_EXPIRES_IN = '28800s';
  process.env.ADMIN_DEFAULT_PASSWORD = AUTH_SEEDED.ADMIN_PASSWORD;

  const dataSource = new DataSource({
    type: 'postgres',
    host: process.env.DB_HOST ?? 'localhost',
    port: parseInt(process.env.DB_PORT ?? '5432', 10),
    username: process.env.DB_USERNAME ?? 'postgres',
    password: process.env.DB_PASSWORD ?? 'postgres',
    database: process.env.DB_NAME ?? 'postgres',
    synchronize: false,
    migrations: [
      CreateInitialMultiTenantRbacSchema1760000000000,
      CreateVehicleCatalogSchema1760000000001,
      CreateAccessAndBlockSchema1760000000002,
      CreateMovementAndOccupancySchema1760000000003,
      CreateRequestDeviceImportSchema1760000000004,
      CreateUserCompanySchema1760000000005,
      AddLastLoginAtToUser1760000000007,
      UniqueUserRolePerUserCompany1760000000008,
      DropUserObservation1760000000009,
      AdaptImportJobSchema1760000000010,
      SeedInitialPermissions1760001000000,
      SeedDefaultCompanyRolesAdminVehicleTypes1760001000001,
    ],
  });
  await dataSource.initialize();
  await dataSource.runMigrations();

  const moduleFixture: TestingModule = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();
  const app = moduleFixture.createNestApplication();
  await app.init();

  const httpServer = app.getHttpServer();

  return {
    app,
    httpServer,
    dataSource,
    loginAndGetToken: createLoginAndGetToken(httpServer, moduleFixture),
    resetThrottle: () => resetThrottle(moduleFixture),
    seedUserWithRole: (email, roleId) =>
      seedUserWithRole(dataSource, email, roleId),
    pollJobUntilFinished: (jobId, token, timeoutMs = 30000) =>
      pollJobUntilFinished(httpServer, jobId, token, timeoutMs),
    close: async () => {
      await app.close();
      if (dataSource.isInitialized) {
        await dataSource.destroy();
      }
      await postgres.stop();
      await redis.stop();
    },
  };
}

/**
 * Cria um usuário (com a senha do admin seedado) e o vincula a um cargo na
 * SOMAR — o vínculo `user_company` fica ativo (necessário para o importador
 * de vínculo usuário-veículo).
 *
 * @param dataSource Conexão com o banco de teste.
 * @param email E-mail do novo usuário.
 * @param roleId Cargo a vincular.
 */
async function seedUserWithRole(
  dataSource: DataSource,
  email: string,
  roleId: string,
): Promise<void> {
  const rows = await dataSource.query(
    `INSERT INTO "user" ("id", "name", "email", "password")
     SELECT gen_random_uuid(), $1, $2, "password"
     FROM "user" WHERE "id" = $3
     RETURNING "id"`,
    ['Usuário de teste', email, AUTH_SEEDED.ADMIN_USER_ID],
  );
  const userId = rows[0]?.id;
  if (!userId) {
    throw new Error('Falha ao criar usuário de teste.');
  }

  await dataSource.query(
    `INSERT INTO "user_company" ("id", "user_id", "company_id", "type", "is_active")
     VALUES (gen_random_uuid(), $1, $2, 'EMPLOYEE', true)
     ON CONFLICT ("user_id", "company_id") DO NOTHING`,
    [userId, VEHICLES_IMPORT_SEEDED.SOMAR_COMPANY_ID],
  );

  await dataSource.query(
    `INSERT INTO "user_role" ("id", "company_id", "user_id", "role_id")
     VALUES (gen_random_uuid(), $1, $2, $3)
     ON CONFLICT ("company_id", "user_id") DO NOTHING`,
    [VEHICLES_IMPORT_SEEDED.SOMAR_COMPANY_ID, userId, roleId],
  );
}

/**
 * Faz polling em `GET /import-jobs/:jobId` até o job finalizar (DONE/FAILED).
 *
 * @param httpServer Servidor HTTP da aplicação de teste.
 * @param jobId Id do job.
 * @param token Token de acesso.
 * @param timeoutMs Tempo máximo de espera (default 30s).
 * @returns O job finalizado.
 * @throws {Error} Em timeout ou falha de leitura.
 */
async function pollJobUntilFinished(
  httpServer: Parameters<typeof request>[0],
  jobId: string,
  token: string,
  timeoutMs: number,
): Promise<JobPollResult> {
  const start = Date.now();

  while (Date.now() - start < timeoutMs) {
    const res = await request(httpServer)
      .get(`/import-jobs/${jobId}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    const status: JobPollResult['status'] = res.body.status;
    if (status === 'DONE' || status === 'FAILED') {
      return {
        status,
        errorMessage: res.body.errorMessage,
        successCount: res.body.successCount,
        errorCount: res.body.errorCount,
      };
    }

    await new Promise((resolve) => setTimeout(resolve, 200));
  }

  throw new Error('Timeout aguardando o job de importação finalizar.');
}
