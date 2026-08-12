import {
  PostgreSqlContainer,
  StartedPostgreSqlContainer,
} from '@testcontainers/postgresql';
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { AppModule } from '../../../../app.module';
import { CreateInitialMultiTenantRbacSchema1760000000000 } from '../../../../shared/database/typeorm/migrations/0001-create-initial-multi-tenant-rbac-schema';
import { CreateVehicleCatalogSchema1760000000001 } from '../../../../shared/database/typeorm/migrations/0002-create-vehicle-catalog-schema';
import { CreateAccessAndBlockSchema1760000000002 } from '../../../../shared/database/typeorm/migrations/0003-create-access-and-block-schema';
import { CreateMovementAndOccupancySchema1760000000003 } from '../../../../shared/database/typeorm/migrations/0004-create-movement-and-occupancy-schema';
import { CreateRequestDeviceImportSchema1760000000004 } from '../../../../shared/database/typeorm/migrations/0005-create-request-device-import-schema';
import { CreateUserCompanySchema1760000000005 } from '../../../../shared/database/typeorm/migrations/0006-create-user-company-schema';
import { SeedInitialPermissions1760001000000 } from '../../../../shared/database/typeorm/seeds/0001-seed-initial-permissions';
import { SeedDefaultCompanyRolesAdminVehicleTypes1760001000001 } from '../../../../shared/database/typeorm/seeds/0002-seed-default-company-roles-admin-vehicle-types';

jest.setTimeout(120000);

/**
 * E2E do fluxo de autenticação multi-empresa (ADR 0002) num Postgres real
 * (Testcontainers): migrations + seeds aplicados do zero + HTTP via supertest.
 *
 * Cobre: login direto (1 empresa), escolha de empresa (N empresas), listagem,
 * troca de empresa, 401 indistinguível e revalidação do vínculo por requisição.
 */
describe('Auth (e2e) — multi-empresa (ADR 0002)', () => {
  let container: StartedPostgreSqlContainer;
  let dataSource: DataSource;
  let app: INestApplication;

  const SOMAR_COMPANY_ID = '10000000-0000-0000-0000-000000000001';
  const ADMIN_USER_ID = '30000000-0000-0000-0000-000000000001';
  const SECOND_COMPANY_ID = '90000000-0000-0000-0000-000000000009';
  const ADMIN_EMAIL = 'admin@somar.local';
  const ADMIN_PASSWORD = 'admin123';

  beforeAll(async () => {
    container = await new PostgreSqlContainer('postgres:16-alpine').start();
    process.env.DB_HOST = container.getHost();
    process.env.DB_PORT = String(container.getMappedPort(5432));
    process.env.DB_USERNAME = container.getUsername();
    process.env.DB_PASSWORD = container.getPassword();
    process.env.DB_NAME = container.getDatabase();
    process.env.DB_SYNCHRONIZE = 'false';
    process.env.DB_LOGGING = 'false';
    process.env.JWT_SECRET = 'e2e-test-secret';
    process.env.JWT_EXPIRES_IN = '28800s';
    process.env.ADMIN_DEFAULT_PASSWORD = ADMIN_PASSWORD;

    // Aplica migrations + seeds do zero num Postgres real (classes explícitas
    // para carregar os .ts via ts-jest). Opções explícitas p/ manter o literal
    // `type: 'postgres'` no construtor do DataSource.
    dataSource = new DataSource({
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
        SeedInitialPermissions1760001000000,
        SeedDefaultCompanyRolesAdminVehicleTypes1760001000001,
      ],
    });
    await dataSource.initialize();
    await dataSource.runMigrations();

    const moduleFixture = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
    if (dataSource?.isInitialized) {
      await dataSource.destroy();
    }
    await container.stop();
  });

  describe('login — 1 empresa (sessão direta)', () => {
    let token: string;

    it('login correto → 200 com sessão JWT', async () => {
      const res = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD })
        .expect(200);

      expect(res.body).toMatchObject({
        tokenType: 'Bearer',
        expiresIn: 28800,
        user: { email: ADMIN_EMAIL, type: 'EMPLOYEE' },
      });
      expect(typeof res.body.accessToken).toBe('string');
      token = res.body.accessToken as string;
    });

    it('senha errada → 401 indistinguível', async () => {
      await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: ADMIN_EMAIL, password: 'senha-errada' })
        .expect(401);
    });

    it('email inexistente → 401 indistinguível', async () => {
      await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: 'nobody@somar.local', password: ADMIN_PASSWORD })
        .expect(401);
    });

    it('GET /auth/companies com token → [SOMAR]', async () => {
      const res = await request(app.getHttpServer())
        .get('/auth/companies')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(res.body).toEqual([{ id: SOMAR_COMPANY_ID, name: 'SOMAR' }]);
    });

    it('GET /auth/companies sem token → 401', async () => {
      await request(app.getHttpServer()).get('/auth/companies').expect(401);
    });

    it('switch-company para empresa sem vínculo → 401', async () => {
      await request(app.getHttpServer())
        .post('/auth/switch-company')
        .set('Authorization', `Bearer ${token}`)
        .send({ companyId: '00000000-0000-0000-0000-000000000000' })
        .expect(401);
    });
  });

  describe('com 2 empresas vinculadas (escolha de empresa)', () => {
    let token: string;

    beforeAll(async () => {
      await dataSource.query(
        `INSERT INTO "company" ("id", "name", "is_active", "timezone")
         VALUES ($1, 'Autarquia B', true, 'America/Sao_Paulo')
         ON CONFLICT ("id") DO NOTHING`,
        [SECOND_COMPANY_ID],
      );
      await dataSource.query(
        `INSERT INTO "user_company" ("id", "user_id", "company_id", "type", "is_active")
         VALUES (gen_random_uuid(), $1, $2, 'EMPLOYEE', true)
         ON CONFLICT ("user_id", "company_id") DO NOTHING`,
        [ADMIN_USER_ID, SECOND_COMPANY_ID],
      );

      const login = await request(app.getHttpServer())
        .post('/auth/login')
        .send({
          email: ADMIN_EMAIL,
          password: ADMIN_PASSWORD,
          companyId: SOMAR_COMPANY_ID,
        })
        .expect(200);
      token = login.body.accessToken as string;
    });

    it('login sem companyId → requiresCompanyChoice com as 2 empresas', async () => {
      const res = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD })
        .expect(200);

      expect(res.body.requiresCompanyChoice).toBe(true);
      expect(res.body.companies).toEqual(
        expect.arrayContaining([
          { id: SOMAR_COMPANY_ID, name: 'SOMAR' },
          { id: SECOND_COMPANY_ID, name: 'Autarquia B' },
        ]),
      );
    });

    it('login com companyId → sessão na empresa escolhida', async () => {
      const res = await request(app.getHttpServer())
        .post('/auth/login')
        .send({
          email: ADMIN_EMAIL,
          password: ADMIN_PASSWORD,
          companyId: SECOND_COMPANY_ID,
        })
        .expect(200);

      expect(res.body.accessToken).toBeDefined();
    });

    it('switch-company válido → 200 com token novo', async () => {
      const res = await request(app.getHttpServer())
        .post('/auth/switch-company')
        .set('Authorization', `Bearer ${token}`)
        .send({ companyId: SECOND_COMPANY_ID })
        .expect(200);

      expect(res.body.accessToken).toBeDefined();
      expect(res.body.user.companyId).toBeUndefined(); // user não expõe companyId — é da sessão
    });

    it('revalidação por requisição: desativar o vínculo derruba a sessão', async () => {
      const switched = await request(app.getHttpServer())
        .post('/auth/switch-company')
        .set('Authorization', `Bearer ${token}`)
        .send({ companyId: SECOND_COMPANY_ID })
        .expect(200);
      const secondToken = switched.body.accessToken as string;

      // Funciona enquanto o vínculo existe...
      await request(app.getHttpServer())
        .get('/auth/companies')
        .set('Authorization', `Bearer ${secondToken}`)
        .expect(200);

      // ...e o mesmo token é recusado quando o vínculo é desativado.
      await dataSource.query(
        `UPDATE "user_company" SET "is_active" = false
         WHERE "user_id" = $1 AND "company_id" = $2`,
        [ADMIN_USER_ID, SECOND_COMPANY_ID],
      );

      await request(app.getHttpServer())
        .get('/auth/companies')
        .set('Authorization', `Bearer ${secondToken}`)
        .expect(401);
    });
  });
});
