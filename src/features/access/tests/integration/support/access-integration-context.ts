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
 * IDs e credenciais usados pelos testes de integração da feature `access`
 * (ADR 0010 — M3; seeds 0001–0002 + helpers de seed).
 */
export const ACCESS_SEEDED = {
  SOMAR_COMPANY_ID: AUTH_SEEDED.SOMAR_COMPANY_ID,
  ADMIN_EMAIL: AUTH_SEEDED.ADMIN_EMAIL,
  ADMIN_PASSWORD: AUTH_SEEDED.ADMIN_PASSWORD,
  /** Cargo `Porteiro` (tem REGISTER_ENTRY/REGISTER_EXIT, sem MANAGE_BLOCKS). */
  PORTEIRO_ROLE_ID: '20000000-0000-0000-0000-000000000004',
  /** Tipo seedado `FROTA` (is_fleet = true). */
  FROTA_TYPE_ID: '40000000-0000-0000-0000-000000000001',
} as const;

/** Contexto de integração da feature `access`. */
export interface AccessIntegrationContext {
  app: INestApplication;
  httpServer: Parameters<typeof request>[0];
  dataSource: DataSource;
  loginAndGetToken: (email: string, password: string) => Promise<string>;
  resetThrottle: () => void;
  seedUserWithRole: (email: string, roleId: string) => Promise<void>;
  findUserIdByEmail: (email: string) => Promise<string | null>;
  countInsideByPlate: (plate: string) => Promise<number>;
  countDenialsByPlate: (plate: string) => Promise<number>;
  countMovementsByType: (plate: string, type: string) => Promise<number>;
  close: () => Promise<void>;
}

/**
 * Monta o app de integração da feature `access` — Testcontainers (Postgres
 * real) + migrations/seeds do zero + `AppModule` (com `AccessModule`) + HTTP
 * via supertest.
 *
 * Espelha `createBlocksIntegrationContext`: valida mapeamento ORM, guards,
 * `ValidationPipe` e as rotas de `/access/*`.
 */
export async function createAccessIntegrationContext(): Promise<AccessIntegrationContext> {
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
    findUserIdByEmail: (email) => findUserIdByEmail(dataSource, email),
    countInsideByPlate: (plate) => countInsideByPlate(dataSource, plate),
    countDenialsByPlate: (plate) => countDenialsByPlate(dataSource, plate),
    countMovementsByType: (plate, type) =>
      countMovementsByType(dataSource, plate, type),
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
 * Cria um usuário (com a senha do admin seedado) e o vincula a um cargo na
 * SOMAR.
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
    [userId, ACCESS_SEEDED.SOMAR_COMPANY_ID],
  );

  await dataSource.query(
    `INSERT INTO "user_role" ("id", "company_id", "user_id", "role_id")
     VALUES (gen_random_uuid(), $1, $2, $3)
     ON CONFLICT ("company_id", "user_id") DO NOTHING`,
    [ACCESS_SEEDED.SOMAR_COMPANY_ID, userId, roleId],
  );
}

/**
 * Busca o id da pessoa por e-mail.
 *
 * @param dataSource Conexão com o banco de teste.
 * @param email E-mail da pessoa.
 * @returns Id da pessoa ou `null`.
 */
async function findUserIdByEmail(
  dataSource: DataSource,
  email: string,
): Promise<string | null> {
  const rows = await dataSource.query(
    `SELECT "id" FROM "user" WHERE "email" = $1`,
    [email],
  );
  return rows[0]?.id ?? null;
}

/**
 * Conta os acessos INSIDE de uma placa (veículo cadastrado OU placa
 * temporária).
 *
 * @param dataSource Conexão com o banco de teste.
 * @param plate Placa normalizada.
 * @returns Quantidade de acessos INSIDE.
 */
async function countInsideByPlate(
  dataSource: DataSource,
  plate: string,
): Promise<number> {
  const rows = await dataSource.query(
    `SELECT COUNT(*)::int AS count
     FROM "vehicle_access" va
     LEFT JOIN "vehicle" v ON v."id" = va."vehicle_id"
     WHERE va."status" = 'INSIDE'
       AND (v."plate" = $1 OR va."temporary_plate" = $1)`,
    [plate],
  );
  return rows[0]?.count ?? 0;
}

/**
 * Conta os impedimentos de uma placa (ledger `entry_denial`).
 *
 * @param dataSource Conexão com o banco de teste.
 * @param plate Placa normalizada.
 * @returns Quantidade de impedimentos.
 */
async function countDenialsByPlate(
  dataSource: DataSource,
  plate: string,
): Promise<number> {
  const rows = await dataSource.query(
    `SELECT COUNT(*)::int AS count FROM "entry_denial" WHERE "plate_snapshot" = $1`,
    [plate],
  );
  return rows[0]?.count ?? 0;
}

/**
 * Conta os movimentos de um tipo de uma placa (ledger).
 *
 * @param dataSource Conexão com o banco de teste.
 * @param plate Placa normalizada.
 * @param type `ENTRY` ou `EXIT`.
 * @returns Quantidade de movimentos.
 */
async function countMovementsByType(
  dataSource: DataSource,
  plate: string,
  type: string,
): Promise<number> {
  const rows = await dataSource.query(
    `SELECT COUNT(*)::int AS count FROM "vehicle_movement" WHERE "plate_snapshot" = $1 AND "type" = $2`,
    [plate, type],
  );
  return rows[0]?.count ?? 0;
}
