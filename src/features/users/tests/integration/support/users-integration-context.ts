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
     ON CONFLICT ("company_id", "user_id", "role_id") DO NOTHING`,
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
