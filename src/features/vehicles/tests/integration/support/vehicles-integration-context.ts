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
    seedUserWithPermissions: (email, codes) =>
      seedUserWithPermissions(dataSource, email, codes),
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
     ON CONFLICT ("company_id", "user_id", "role_id") DO NOTHING`,
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
     ON CONFLICT ("company_id", "user_id", "role_id") DO NOTHING`,
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
