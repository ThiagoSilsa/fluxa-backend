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

// Seeds
import { SeedInitialPermissions1760001000000 } from '../../../../../shared/database/typeorm/seeds/0001-seed-initial-permissions';
import { SeedDefaultCompanyRolesAdminVehicleTypes1760001000001 } from '../../../../../shared/database/typeorm/seeds/0002-seed-default-company-roles-admin-vehicle-types';

// Test support
import { createLoginAndGetToken } from '../../../../../test/support/login-and-get-token';
import { PostgresTestContainer } from '../../../../../test/support/postgres-test-container';
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
