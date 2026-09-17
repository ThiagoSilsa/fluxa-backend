// NestJS
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { DataSource } from 'typeorm';

// Test support
import { createIntegrationApp } from '../../../../../test/support/integration-app';
import { createIntegrationDataSource } from '../../../../../test/support/integration-data-source';
import { createLoginAndGetToken } from '../../../../../test/support/login-and-get-token';
import { PostgresTestContainer } from '../../../../../test/support/postgres-test-container';
import { RedisTestContainer } from '../../../../../test/support/redis-test-container';
import { resetThrottle } from '../../../../../test/support/reset-throttle';

// Auth (dados seedados compartilhados)
import { AUTH_SEEDED } from '../../../../auth/tests/integration/support/auth-integration-context';

/**
 * IDs e credenciais usados pelos testes de integração do importador de
 * departamentos.
 */
export const DEPARTMENTS_IMPORT_SEEDED = {
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
  errorCode: string | null;
  errorParams: Record<string, string | number> | null;
  successCount: number;
  errorCount: number;
}

/** Contexto de integração do importador de departamentos. */
export interface DepartmentsImportIntegrationContext {
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
 * Monta o app de integração do importador de departamentos — Postgres e Redis
 * via Testcontainers (o worker BullMQ precisa de Redis de verdade — ADR 0007
 * §10) + migrations/seeds do zero + `AppModule` + HTTP via supertest.
 */
export async function createDepartmentsImportIntegrationContext(): Promise<DepartmentsImportIntegrationContext> {
  const postgres = new PostgresTestContainer();
  await postgres.start();

  const redis = new RedisTestContainer();
  await redis.start();

  process.env.JWT_SECRET = 'integration-test-secret';
  process.env.JWT_EXPIRES_IN = '28800s';
  process.env.ADMIN_DEFAULT_PASSWORD = AUTH_SEEDED.ADMIN_PASSWORD;

  const dataSource = createIntegrationDataSource();
  await dataSource.initialize();
  await dataSource.runMigrations();

  const { app, moduleFixture } = await createIntegrationApp();

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
 * SOMAR — para cenários de autorização (ex.: Porteiro sem MANAGE_IMPORTS).
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
    [userId, DEPARTMENTS_IMPORT_SEEDED.SOMAR_COMPANY_ID],
  );

  await dataSource.query(
    `INSERT INTO "user_role" ("id", "company_id", "user_id", "role_id")
     VALUES (gen_random_uuid(), $1, $2, $3)
     ON CONFLICT ("company_id", "user_id") DO NOTHING`,
    [DEPARTMENTS_IMPORT_SEEDED.SOMAR_COMPANY_ID, userId, roleId],
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
        errorCode: res.body.errorCode,
        errorParams: res.body.errorParams,
        successCount: res.body.successCount,
        errorCount: res.body.errorCount,
      };
    }

    await new Promise((resolve) => setTimeout(resolve, 200));
  }

  throw new Error('Timeout aguardando o job de importação finalizar.');
}
