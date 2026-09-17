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
 * IDs e credenciais usados pelos testes de integração da feature `vehicles`
 * (seeds 0001–0002 + helpers de seed criados aqui).
 */
export const VEHICLES_SEEDED = {
  SOMAR_COMPANY_ID: AUTH_SEEDED.SOMAR_COMPANY_ID,
  ADMIN_EMAIL: AUTH_SEEDED.ADMIN_EMAIL,
  ADMIN_PASSWORD: AUTH_SEEDED.ADMIN_PASSWORD,
  /** Cargo `Porteiro` (sem MANAGE_VEHICLES/MANAGE_VEHICLE_TYPES). */
  PORTEIRO_ROLE_ID: '20000000-0000-0000-0000-000000000004',
  /** Tipo seedado `FROTA` (is_fleet = true). */
  FROTA_TYPE_ID: '40000000-0000-0000-0000-000000000001',
  /** Tipo seedado `PARTICULAR`. */
  PARTICULAR_TYPE_ID: '40000000-0000-0000-0000-000000000002',
} as const;

/** Contexto de integração da feature `vehicles`. */
export interface VehiclesIntegrationContext {
  app: INestApplication;
  httpServer: Parameters<typeof request>[0];
  dataSource: DataSource;
  loginAndGetToken: (email: string, password: string) => Promise<string>;
  resetThrottle: () => void;
  seedUserWithRole: (email: string, roleId: string) => Promise<void>;
  seedUserWithPermissions: (email: string, codes: string[]) => Promise<void>;
  findUserIdByEmail: (email: string) => Promise<string | null>;
  close: () => Promise<void>;
}

/**
 * Monta o app de integração da feature `vehicles` — Testcontainers (Postgres
 * real) + migrations/seeds do zero + `AppModule` (com `VehiclesModule`) + HTTP
 * via supertest.
 *
 * Espelha `createRolesIntegrationContext`: valida mapeamento ORM, guards,
 * `ValidationPipe` e as rotas de `/vehicle-types` e `/vehicles`.
 */
export async function createVehiclesIntegrationContext(): Promise<VehiclesIntegrationContext> {
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
    seedUserWithRole: (email, roleId) =>
      seedUserWithRole(dataSource, email, roleId),
    seedUserWithPermissions: (email, codes) =>
      seedUserWithPermissions(dataSource, email, codes),
    findUserIdByEmail: (email) => findUserIdByEmail(dataSource, email),
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
 * Cria um usuário (com a senha do admin seedado) e o vincula a um cargo
 * existente na SOMAR — para cenários de autorização (ex.: Porteiro sem
 * MANAGE_VEHICLES).
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
  const userId = await insertTestUser(dataSource, email);
  await dataSource.query(
    `INSERT INTO "user_role" ("id", "company_id", "user_id", "role_id")
     VALUES (gen_random_uuid(), $1, $2, $3)
     ON CONFLICT ("company_id", "user_id") DO NOTHING`,
    [VEHICLES_SEEDED.SOMAR_COMPANY_ID, userId, roleId],
  );
}

/**
 * Cria um usuário com um cargo novo cujas permissões são exatamente as
 * informadas — para cenários de permissão granular (ex.: MANAGE_VEHICLES sem
 * GRANT_FREE_PASS).
 *
 * @param dataSource Conexão com o banco de teste.
 * @param email E-mail do novo usuário.
 * @param codes Códigos de permissão do cargo.
 */
async function seedUserWithPermissions(
  dataSource: DataSource,
  email: string,
  codes: string[],
): Promise<void> {
  const userId = await insertTestUser(dataSource, email);

  const roleRows = await dataSource.query(
    `INSERT INTO "role" ("id", "company_id", "name", "description", "is_admin", "is_active")
     VALUES (gen_random_uuid(), $1, 'Cargo de teste', '', false, true)
     RETURNING "id"`,
    [VEHICLES_SEEDED.SOMAR_COMPANY_ID],
  );
  const roleId = roleRows[0]?.id;
  if (!roleId) {
    throw new Error('Falha ao criar cargo de teste.');
  }

  for (const code of codes) {
    await dataSource.query(
      `INSERT INTO "role_permission" ("id", "company_id", "role_id", "permission_id")
       SELECT gen_random_uuid(), $1, $2, "id"
       FROM "permission" WHERE "code" = $3`,
      [VEHICLES_SEEDED.SOMAR_COMPANY_ID, roleId, code],
    );
  }

  await dataSource.query(
    `INSERT INTO "user_role" ("id", "company_id", "user_id", "role_id")
     VALUES (gen_random_uuid(), $1, $2, $3)
     ON CONFLICT ("company_id", "user_id") DO NOTHING`,
    [VEHICLES_SEEDED.SOMAR_COMPANY_ID, userId, roleId],
  );
}

/**
 * Insere um usuário de teste (pessoa + vínculo `user_company`) com a senha do
 * admin seedado.
 *
 * @param dataSource Conexão com o banco de teste.
 * @param email E-mail do novo usuário.
 * @returns Id do usuário criado.
 */
async function insertTestUser(
  dataSource: DataSource,
  email: string,
): Promise<string> {
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
    [userId, VEHICLES_SEEDED.SOMAR_COMPANY_ID],
  );

  return userId as string;
}

/**
 * Busca o id de um usuário pelo e-mail (para os testes de vínculos).
 *
 * @param dataSource Conexão com o banco de teste.
 * @param email E-mail do usuário.
 * @returns Id do usuário ou `null`.
 */
async function findUserIdByEmail(
  dataSource: DataSource,
  email: string,
): Promise<string | null> {
  const rows = await dataSource.query(
    `SELECT "id" FROM "user" WHERE "email" = $1`,
    [email],
  );
  const first = rows?.[0] as { id?: string } | undefined;
  return first?.id ?? null;
}
