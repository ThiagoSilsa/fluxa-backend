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
 * IDs e credenciais usados pelos testes de integração da feature `users`
 * (seeds 0001–0002 + helpers de seed criados aqui).
 */
export const USERS_SEEDED = {
  SOMAR_COMPANY_ID: AUTH_SEEDED.SOMAR_COMPANY_ID,
  ADMIN_USER_ID: AUTH_SEEDED.ADMIN_USER_ID,
  ADMIN_EMAIL: AUTH_SEEDED.ADMIN_EMAIL,
  ADMIN_PASSWORD: AUTH_SEEDED.ADMIN_PASSWORD,
  /** 2ª empresa (sem admin seedado) para cenários multi-empresa. */
  SECOND_COMPANY_ID: AUTH_SEEDED.SECOND_COMPANY_ID,
  /** Cargo `Administração` (is_admin = true) — gestão exclusiva de admin. */
  ADMIN_ROLE_ID: '20000000-0000-0000-0000-000000000001',
  /** Cargo `Porteiro` (sem MANAGE_USERS). */
  PORTEIRO_ROLE_ID: '20000000-0000-0000-0000-000000000004',
} as const;

/** Contexto de integração da feature `users`. */
export interface UsersIntegrationContext {
  app: INestApplication;
  httpServer: Parameters<typeof request>[0];
  dataSource: DataSource;
  loginAndGetToken: (email: string, password: string) => Promise<string>;
  resetThrottle: () => void;
  findRoleIdByName: (name: string) => Promise<string | null>;
  findPermissionIdByCode: (code: string) => Promise<string | null>;
  findUserIdByEmail: (email: string) => Promise<string | null>;
  seedUserWithRole: (email: string, roleId: string) => Promise<string>;
  seedUserInSecondCompany: (email: string) => Promise<string>;
  close: () => Promise<void>;
}

/**
 * Monta o app de integração da feature `users` — Testcontainers (Postgres
 * real) + migrations/seeds do zero + `AppModule` (com `UsersModule`) + HTTP
 * via supertest.
 *
 * Espelha `createRolesIntegrationContext`: valida mapeamento ORM, guards,
 * `ValidationPipe` e as rotas de `/users`.
 */
export async function createUsersIntegrationContext(): Promise<UsersIntegrationContext> {
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
    findUserIdByEmail: (email) => findUserIdByEmail(dataSource, email),
    seedUserWithRole: (email, roleId) =>
      seedUserWithRole(dataSource, email, roleId),
    seedUserInSecondCompany: (email) =>
      seedUserInSecondCompany(dataSource, email),
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
    [name, USERS_SEEDED.SOMAR_COMPANY_ID],
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
 * Busca o id da pessoa pelo e-mail.
 *
 * @param dataSource Conexão com o banco de teste.
 * @param email E-mail da pessoa.
 * @returns Id da pessoa ou `null`.
 */
async function findUserIdByEmail(
  dataSource: DataSource,
  email: string,
): Promise<string | null> {
  const row = await dataSource.query(
    `SELECT "id" FROM "user" WHERE "email" = $1`,
    [email],
  );
  const first = row?.[0] as { id?: string } | undefined;
  return first?.id ?? null;
}

/**
 * Cria um usuário na SOMAR (com a senha do admin seedado) vinculado a um
 * cargo — para cenários de autorização (ex.: Porteiro sem MANAGE_USERS).
 *
 * @param dataSource Conexão com o banco de teste.
 * @param email E-mail do novo usuário.
 * @param roleId Cargo a vincular.
 * @returns Id do usuário criado.
 */
async function seedUserWithRole(
  dataSource: DataSource,
  email: string,
  roleId: string,
): Promise<string> {
  const rows = await dataSource.query(
    `INSERT INTO "user" ("id", "name", "email", "password")
     SELECT gen_random_uuid(), $1, $2, "password"
     FROM "user" WHERE "id" = $3
     RETURNING "id"`,
    ['Usuário de teste', email, USERS_SEEDED.ADMIN_USER_ID],
  );
  const userId = rows[0]?.id;
  if (!userId) {
    throw new Error('Falha ao criar usuário de teste.');
  }

  await dataSource.query(
    `INSERT INTO "user_company" ("id", "user_id", "company_id", "type", "is_active")
     VALUES (gen_random_uuid(), $1, $2, 'EMPLOYEE', true)
     ON CONFLICT ("user_id", "company_id") DO NOTHING`,
    [userId, USERS_SEEDED.SOMAR_COMPANY_ID],
  );
  await dataSource.query(
    `INSERT INTO "user_role" ("id", "company_id", "user_id", "role_id")
     VALUES (gen_random_uuid(), $2, $1, $3)
     ON CONFLICT ("company_id", "user_id") DO NOTHING`,
    [userId, USERS_SEEDED.SOMAR_COMPANY_ID, roleId],
  );
  return userId;
}

/**
 * Cria uma 2ª empresa e um usuário vinculado a ela (com a senha do admin
 * seedado) — para o cenário de "pessoa já existe em outra empresa" (criar só
 * o vínculo na SOMAR).
 *
 * @param dataSource Conexão com o banco de teste.
 * @param email E-mail do novo usuário.
 * @returns Id do usuário criado.
 */
async function seedUserInSecondCompany(
  dataSource: DataSource,
  email: string,
): Promise<string> {
  await dataSource.query(
    `INSERT INTO "company" ("id", "name", "is_active", "timezone")
     VALUES ($1, 'Autarquia B', true, 'America/Sao_Paulo')
     ON CONFLICT ("id") DO NOTHING`,
    [USERS_SEEDED.SECOND_COMPANY_ID],
  );

  const rows = await dataSource.query(
    `INSERT INTO "user" ("id", "name", "email", "password")
     SELECT gen_random_uuid(), 'Maria (outra empresa)', $1, "password"
     FROM "user" WHERE "id" = $2
     RETURNING "id"`,
    [email, USERS_SEEDED.ADMIN_USER_ID],
  );
  const userId = rows[0]?.id;
  if (!userId) {
    throw new Error('Falha ao criar usuário na 2ª empresa.');
  }

  await dataSource.query(
    `INSERT INTO "user_company" ("id", "user_id", "company_id", "type", "is_active")
     VALUES (gen_random_uuid(), $1, $2, 'EMPLOYEE', true)
     ON CONFLICT ("user_id", "company_id") DO NOTHING`,
    [userId, USERS_SEEDED.SECOND_COMPANY_ID],
  );
  return userId;
}
