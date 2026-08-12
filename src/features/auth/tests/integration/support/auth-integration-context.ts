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

  // Segredos/ambiente antes de compilar o módulo (ConfigModule lê no init).
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

  if (options.seedSecondCompany) {
    await seedSecondCompany(dataSource);
  }

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
