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

// Auth (dados seedados compartilhados)
import { AUTH_SEEDED } from '../../../../auth/tests/integration/support/auth-integration-context';

/**
 * IDs e credenciais usados pelos testes de integração da feature `roles`
 * (seeds 0001–0002 + helpers de seed criados aqui).
 */
export const ROLES_SEEDED = {
  SOMAR_COMPANY_ID: AUTH_SEEDED.SOMAR_COMPANY_ID,
  ADMIN_EMAIL: AUTH_SEEDED.ADMIN_EMAIL,
  ADMIN_PASSWORD: AUTH_SEEDED.ADMIN_PASSWORD,
  /** Cargo `Administração` (is_admin = true) — imutável pelo CRUD. */
  ADMIN_ROLE_ID: '20000000-0000-0000-0000-000000000001',
  /** Cargo `Porteiro` (sem MANAGE_ROLES). */
  PORTEIRO_ROLE_ID: '20000000-0000-0000-0000-000000000004',
  /** Cargo `is_admin` sem permissões (criado por helper — bypass do guard). */
  ADMIN_BYPASS_ROLE_ID: '50000000-0000-0000-0000-000000000001',
} as const;

/** Contexto de integração da feature `roles`. */
export interface RolesIntegrationContext {
  app: INestApplication;
  httpServer: Parameters<typeof request>[0];
  dataSource: DataSource;
  loginAndGetToken: (email: string, password: string) => Promise<string>;
  resetThrottle: () => void;
  findRoleIdByName: (name: string) => Promise<string | null>;
  findPermissionIdByCode: (code: string) => Promise<string | null>;
  seedUserWithRole: (email: string, roleId: string) => Promise<void>;
  seedAdminUserWithoutPermissions: (email: string) => Promise<void>;
  close: () => Promise<void>;
}

/**
 * Monta o app de integração da feature `roles` — Testcontainers (Postgres
 * real) + migrations/seeds do zero + `AppModule` (com `RolesModule`) + HTTP
 * via supertest.
 *
 * Espelha `createAuthIntegrationContext`: valida mapeamento ORM, guards,
 * `ValidationPipe` e as rotas de `/roles` e `/permissions`.
 */
export async function createRolesIntegrationContext(): Promise<RolesIntegrationContext> {
  const container = new PostgresTestContainer();
  await container.start();

  // Redis próprio: sem ele os workers de importação do `AppModule` conectariam
  // no Redis herdado de outra suíte e consumiriam job alheio (o banco daqui
  // pode nem ter a coluna que o worker grava).
  const redis = new RedisTestContainer();
  await redis.start();

  process.env.JWT_SECRET = 'integration-test-secret';
  process.env.JWT_EXPIRES_IN = '28800s';
  process.env.ADMIN_DEFAULT_PASSWORD = AUTH_SEEDED.ADMIN_PASSWORD;

  const dataSource = createIntegrationDataSource();
  await dataSource.initialize();
  await dataSource.runMigrations();

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
    findRoleIdByName: (name) => findRoleIdByName(dataSource, name),
    findPermissionIdByCode: (code) => findPermissionIdByCode(dataSource, code),
    seedUserWithRole: (email, roleId) =>
      seedUserWithRole(dataSource, email, roleId),
    seedAdminUserWithoutPermissions: (email) =>
      seedAdminUserWithoutPermissions(dataSource, email),
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
 * Busca o id de um cargo pelo nome na empresa SOMAR.
 *
 * @param dataSource Conexão com o banco de teste.
 * @param name Nome do cargo.
 * @returns Id do cargo ou `null`.
 */
async function findRoleIdByName(
  dataSource: DataSource,
  name: string,
): Promise<string | null> {
  const row = await dataSource.query(
    `SELECT "id" FROM "role"
     WHERE "name" = $1 AND "company_id" = $2`,
    [name, ROLES_SEEDED.SOMAR_COMPANY_ID],
  );
  const first = row?.[0] as { id?: string } | undefined;
  return first?.id ?? null;
}

/**
 * Busca o id de uma permissão do catálogo pelo código.
 *
 * @param dataSource Conexão com o banco de teste.
 * @param code Código da permissão.
 * @returns Id da permissão ou `null`.
 */
async function findPermissionIdByCode(
  dataSource: DataSource,
  code: string,
): Promise<string | null> {
  const row = await dataSource.query(
    `SELECT "id" FROM "permission" WHERE "code" = $1`,
    [code],
  );
  const first = row?.[0] as { id?: string } | undefined;
  return first?.id ?? null;
}

/**
 * Cria um usuário (com a senha do admin seedado) e o vincula a um cargo na
 * SOMAR — para cenários de autorização (ex.: Porteiro sem MANAGE_ROLES).
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
    [userId, ROLES_SEEDED.SOMAR_COMPANY_ID],
  );
  await dataSource.query(
    `INSERT INTO "user_role" ("id", "company_id", "user_id", "role_id")
     VALUES (gen_random_uuid(), $2, $1, $3)
     ON CONFLICT ("company_id", "user_id") DO NOTHING`,
    [userId, ROLES_SEEDED.SOMAR_COMPANY_ID, roleId],
  );
}

/**
 * Cria um cargo `is_admin` **sem nenhuma permissão** e um usuário vinculado —
 * para provar o bypass do `PermissionsGuard` (Fase 0 / ADR 0004 §2) na rota
 * `GET /permissions`, sem depender de `MANAGE_ROLES`.
 *
 * @param dataSource Conexão com o banco de teste.
 * @param email E-mail do novo usuário.
 */
async function seedAdminUserWithoutPermissions(
  dataSource: DataSource,
  email: string,
): Promise<void> {
  await dataSource.query(
    `INSERT INTO "role" ("id", "company_id", "name", "description", "is_admin", "is_active")
     VALUES ($1, $2, 'Admin sem permissões', 'Bypass is_admin (ADR 0004)', true, true)
     ON CONFLICT ("id") DO NOTHING`,
    [ROLES_SEEDED.ADMIN_BYPASS_ROLE_ID, ROLES_SEEDED.SOMAR_COMPANY_ID],
  );

  await seedUserWithRole(dataSource, email, ROLES_SEEDED.ADMIN_BYPASS_ROLE_ID);
}
