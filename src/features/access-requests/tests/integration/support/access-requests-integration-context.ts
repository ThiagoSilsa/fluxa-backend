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
 * IDs e credenciais usados pelos testes de integração da feature
 * `access-requests` (ADR 0010 — M2; seeds 0001–0002 + helpers de seed).
 */
export const ACCESS_REQUESTS_SEEDED = {
  SOMAR_COMPANY_ID: AUTH_SEEDED.SOMAR_COMPANY_ID,
  ADMIN_EMAIL: AUTH_SEEDED.ADMIN_EMAIL,
  ADMIN_PASSWORD: AUTH_SEEDED.ADMIN_PASSWORD,
  /** Cargo `Porteiro` (tem CREATE/CANCEL_ACCESS_REQUEST, sem MANAGE_ACCESS_REQUESTS). */
  PORTEIRO_ROLE_ID: '20000000-0000-0000-0000-000000000004',
  /** Tipo seedado `FROTA` (is_fleet = true). */
  FROTA_TYPE_ID: '40000000-0000-0000-0000-000000000001',
} as const;

/** Contexto de integração da feature `access-requests`. */
export interface AccessRequestsIntegrationContext {
  app: INestApplication;
  httpServer: Parameters<typeof request>[0];
  dataSource: DataSource;
  loginAndGetToken: (email: string, password: string) => Promise<string>;
  resetThrottle: () => void;
  seedUserWithRole: (email: string, roleId: string) => Promise<void>;
  findUserIdByEmail: (email: string) => Promise<string | null>;
  isUserByEmail: (email: string) => Promise<boolean>;
  isVehicleByPlate: (plate: string) => Promise<boolean>;
  isLinkByUserAndVehicle: (
    userId: string,
    vehicleId: string,
  ) => Promise<boolean>;
  /**
   * Cria/atualiza o vínculo motorista ↔ veículo com as flags dadas — para
   * montar o estado "vínculo existe sem permissão" (ticket 07).
   */
  upsertLink: (input: {
    userId: string;
    vehicleId: string;
    canDrive: boolean;
    isPrimary?: boolean;
  }) => Promise<void>;
  /** Flags do vínculo motorista ↔ veículo (`null` se não existir). */
  findLink: (
    userId: string,
    vehicleId: string,
  ) => Promise<{ canDrive: boolean; isPrimary: boolean } | null>;
  /** Snapshot da conta (user + user_company + user_role) por e-mail. */
  findAccountByEmail: (
    email: string,
  ) => Promise<AccessRequestAccountSnapshot | null>;
  /** Snapshot da conta (user + user_company + user_role) por telefone. */
  findAccountByPhone: (
    phone: string,
  ) => Promise<AccessRequestAccountSnapshot | null>;
  close: () => Promise<void>;
}

/**
 * Snapshot da conta criada/viculada no aceite — `user` + `user_company` +
 * `user_role` da empresa SOMAR.
 */
export interface AccessRequestAccountSnapshot {
  id: string;
  passwordHash: string | null;
  type: string | null;
  roleId: string | null;
}

/**
 * Monta o app de integração da feature `access-requests` — Testcontainers
 * (Postgres real) + migrations/seeds do zero + `AppModule` (com
 * `AccessRequestsModule`) + HTTP via supertest.
 *
 * Espelha `createBlocksIntegrationContext`: valida mapeamento ORM, guards,
 * `ValidationPipe` e as rotas de `/access-requests`.
 */
export async function createAccessRequestsIntegrationContext(): Promise<AccessRequestsIntegrationContext> {
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
    isUserByEmail: (email) => isUserByEmail(dataSource, email),
    isVehicleByPlate: (plate) => isVehicleByPlate(dataSource, plate),
    isLinkByUserAndVehicle: (userId, vehicleId) =>
      isLinkByUserAndVehicle(dataSource, userId, vehicleId),
    upsertLink: (input) => upsertLink(dataSource, input),
    findLink: (userId, vehicleId) => findLink(dataSource, userId, vehicleId),
    findAccountByEmail: (email) => findAccount(dataSource, 'email', email),
    findAccountByPhone: (phone) => findAccount(dataSource, 'phone', phone),
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
 * SOMAR — para cenários de autorização e de usuário existente (NEW_VEHICLE/
 * LINK).
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
    [userId, ACCESS_REQUESTS_SEEDED.SOMAR_COMPANY_ID],
  );

  await dataSource.query(
    `INSERT INTO "user_role" ("id", "company_id", "user_id", "role_id")
     VALUES (gen_random_uuid(), $1, $2, $3)
     ON CONFLICT ("company_id", "user_id") DO NOTHING`,
    [ACCESS_REQUESTS_SEEDED.SOMAR_COMPANY_ID, userId, roleId],
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
 * Verifica se uma pessoa existe por e-mail (usuário criado no aceite).
 *
 * @param dataSource Conexão com o banco de teste.
 * @param email E-mail da pessoa.
 * @returns `true` se a pessoa existe.
 */
async function isUserByEmail(
  dataSource: DataSource,
  email: string,
): Promise<boolean> {
  const rows = await dataSource.query(
    `SELECT 1 FROM "user" WHERE "email" = $1`,
    [email],
  );
  return rows.length > 0;
}

/**
 * Verifica se um veículo existe por placa (criado no aceite).
 *
 * @param dataSource Conexão com o banco de teste.
 * @param plate Placa normalizada.
 * @returns `true` se o veículo existe.
 */
async function isVehicleByPlate(
  dataSource: DataSource,
  plate: string,
): Promise<boolean> {
  const rows = await dataSource.query(
    `SELECT 1 FROM "vehicle" WHERE "plate" = $1`,
    [plate],
  );
  return rows.length > 0;
}

/**
 * Verifica se existe o vínculo motorista ↔ veículo.
 *
 * @param dataSource Conexão com o banco de teste.
 * @param userId Id do usuário.
 * @param vehicleId Id do veículo.
 * @returns `true` se o vínculo existe.
 */
async function isLinkByUserAndVehicle(
  dataSource: DataSource,
  userId: string,
  vehicleId: string,
): Promise<boolean> {
  const rows = await dataSource.query(
    `SELECT 1 FROM "user_vehicle" WHERE "user_id" = $1 AND "vehicle_id" = $2`,
    [userId, vehicleId],
  );
  return rows.length > 0;
}

/**
 * Cria ou atualiza o vínculo motorista ↔ veículo na SOMAR com as flags dadas.
 *
 * Usado para montar o estado "vínculo existe com `can_drive = false`" — o
 * cenário que o aceite da solicitação da portaria precisa **promover** em vez
 * de recusar (ticket 07).
 *
 * @param dataSource Conexão com o banco de teste.
 * @param input Ids do motorista/veículo e flags do vínculo.
 */
async function upsertLink(
  dataSource: DataSource,
  input: {
    userId: string;
    vehicleId: string;
    canDrive: boolean;
    isPrimary?: boolean;
  },
): Promise<void> {
  await dataSource.query(
    `INSERT INTO "user_vehicle"
       ("company_id", "user_id", "vehicle_id", "is_primary", "can_drive")
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT ("company_id", "user_id", "vehicle_id")
     DO UPDATE SET "is_primary" = EXCLUDED."is_primary",
                   "can_drive" = EXCLUDED."can_drive"`,
    [
      AUTH_SEEDED.SOMAR_COMPANY_ID,
      input.userId,
      input.vehicleId,
      input.isPrimary ?? false,
      input.canDrive,
    ],
  );
}

/**
 * Lê as flags do vínculo motorista ↔ veículo.
 *
 * @param dataSource Conexão com o banco de teste.
 * @param userId Id do motorista.
 * @param vehicleId Id do veículo.
 * @returns `{ canDrive, isPrimary }` ou `null` se o vínculo não existir.
 */
async function findLink(
  dataSource: DataSource,
  userId: string,
  vehicleId: string,
): Promise<{ canDrive: boolean; isPrimary: boolean } | null> {
  const rows = await dataSource.query(
    `SELECT "can_drive" AS "canDrive", "is_primary" AS "isPrimary"
       FROM "user_vehicle"
      WHERE "user_id" = $1 AND "vehicle_id" = $2`,
    [userId, vehicleId],
  );
  return rows.length > 0 ? rows[0] : null;
}

/**
 * Lê a conta criada no aceite na SOMAR — senha, tipo do vínculo e cargo —
 * filtrando por e-mail ou telefone.
 *
 * @param dataSource Conexão com o banco de teste.
 * @param filter Campo do filtro (`email` ou `phone`).
 * @param value Valor do filtro.
 * @returns Snapshot da conta ou `null` se não existir.
 */
async function findAccount(
  dataSource: DataSource,
  filter: 'email' | 'phone',
  value: string,
): Promise<AccessRequestAccountSnapshot | null> {
  const column = filter === 'email' ? '"email"' : '"phone"';
  const rows = await dataSource.query(
    `SELECT u."id" AS "id",
            u."password" AS "passwordHash",
            uc."type" AS "type",
            ur."role_id" AS "roleId"
       FROM "user" u
       LEFT JOIN "user_company" uc
         ON uc."user_id" = u."id" AND uc."company_id" = $2
       LEFT JOIN "user_role" ur
         ON ur."user_id" = u."id" AND ur."company_id" = $2
      WHERE u.${column} = $1`,
    [value, ACCESS_REQUESTS_SEEDED.SOMAR_COMPANY_ID],
  );
  return (rows[0] as AccessRequestAccountSnapshot | undefined) ?? null;
}
