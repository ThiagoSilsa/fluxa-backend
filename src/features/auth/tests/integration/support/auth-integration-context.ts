// NestJS
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { DataSource } from 'typeorm';

// Test support
import { createIntegrationApp } from '../../../../../test/support/integration-app';
import { createLoginAndGetToken } from '../../../../../test/support/login-and-get-token';
import { createIntegrationDataSource } from '../../../../../test/support/integration-data-source';
import { PostgresTestContainer } from '../../../../../test/support/postgres-test-container';
import { RedisTestContainer } from '../../../../../test/support/redis-test-container';
import { resetThrottle } from '../../../../../test/support/reset-throttle';

/**
 * IDs e credenciais dos dados seedados (migrations 0001–0006 + 0008, seeds
 * 0001–0002) — usados pelos testes de integração da feature `auth`.
 */
export const AUTH_SEEDED = {
  SOMAR_COMPANY_ID: '10000000-0000-0000-0000-000000000001',
  ADMIN_USER_ID: '30000000-0000-0000-0000-000000000001',
  ADMIN_EMAIL: 'admin@somar.local',
  ADMIN_PASSWORD: 'admin123',
  SECOND_COMPANY_ID: '90000000-0000-0000-0000-000000000009',
} as const;

/** Opções de criação do contexto de integração. */
export interface CreateAuthIntegrationContextOptions {
  /** Insere uma 2ª empresa (com vínculo do admin) para cenários multi-empresa. */
  seedSecondCompany?: boolean;
}

/** Contexto de integração da feature `auth`. */
export interface AuthIntegrationContext {
  app: INestApplication;
  httpServer: Parameters<typeof request>[0];
  dataSource: DataSource;
  loginAndGetToken: (email: string, password: string) => Promise<string>;
  resetThrottle: () => void;
  close: () => Promise<void>;
}

/**
 * Monta o app de integração da feature `auth` — Testcontainers (Postgres real)
 * + migrations/seeds do zero + `AppModule` + HTTP via supertest.
 *
 * Valida juntos o mapeamento ORM, os guards, o `ValidationPipe` e as rotas.
 * Cada arquivo de teste sobe o próprio container (padrão `testes.md`).
 *
 * @param options Opções de seed (2ª empresa para multi-empresa).
 * @returns Contexto com app, httpServer, dataSource e helpers.
 */
export async function createAuthIntegrationContext(
  options: CreateAuthIntegrationContextOptions = {},
): Promise<AuthIntegrationContext> {
  const container = new PostgresTestContainer();
  await container.start();

  // Redis próprio: sem ele os workers de importação do `AppModule` conectariam
  // no Redis herdado de outra suíte e consumiriam job alheio (o banco daqui
  // pode nem ter a coluna que o worker grava).
  const redis = new RedisTestContainer();
  await redis.start();

  // Segredos/ambiente antes de compilar o módulo (ConfigModule lê no init).
  process.env.JWT_SECRET = 'integration-test-secret';
  process.env.JWT_EXPIRES_IN = '28800s';
  process.env.ADMIN_DEFAULT_PASSWORD = AUTH_SEEDED.ADMIN_PASSWORD;

  const dataSource = createIntegrationDataSource();
  await dataSource.initialize();
  await dataSource.runMigrations();

  if (options.seedSecondCompany) {
    await seedSecondCompany(dataSource);
  }

  const { app, moduleFixture } = await createIntegrationApp();

  return {
    app,
    httpServer: app.getHttpServer(),
    dataSource,
    loginAndGetToken: createLoginAndGetToken(
      app.getHttpServer(),
      moduleFixture,
    ),
    resetThrottle: () => resetThrottle(moduleFixture),
    close: async () => {
      await app.close();
      if (dataSource.isInitialized) {
        await dataSource.destroy();
      }
      await container.stop();
      await redis.stop();
    },
  };
}

/**
 * Insere a 2ª empresa (com vínculo do admin) para cenários multi-empresa.
 *
 * @param dataSource Conexão com o banco de teste.
 */
async function seedSecondCompany(dataSource: DataSource): Promise<void> {
  await dataSource.query(
    `INSERT INTO "company" ("id", "name", "is_active", "timezone")
     VALUES ($1, 'Autarquia B', true, 'America/Sao_Paulo')
     ON CONFLICT ("id") DO NOTHING`,
    [AUTH_SEEDED.SECOND_COMPANY_ID],
  );
  await dataSource.query(
    `INSERT INTO "user_company" ("id", "user_id", "company_id", "type", "is_active")
     VALUES (gen_random_uuid(), $1, $2, 'EMPLOYEE', true)
     ON CONFLICT ("user_id", "company_id") DO NOTHING`,
    [AUTH_SEEDED.ADMIN_USER_ID, AUTH_SEEDED.SECOND_COMPANY_ID],
  );
}
