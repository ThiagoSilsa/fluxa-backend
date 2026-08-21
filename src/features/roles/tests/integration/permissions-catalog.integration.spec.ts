// Supertest
import request from 'supertest';

// Support
import {
  createRolesIntegrationContext,
  ROLES_SEEDED,
  RolesIntegrationContext,
} from './support/roles-integration-context';

jest.setTimeout(120000);

describe('Roles integration — catálogo de permissões + bypass is_admin (Testcontainers)', () => {
  let context: RolesIntegrationContext;

  beforeAll(async () => {
    context = await createRolesIntegrationContext();
  });

  afterAll(async () => {
    await context.close();
  });

  it('GET /permissions com admin → 200 com o catálogo (23 permissões)', async () => {
    const token = await context.loginAndGetToken(
      ROLES_SEEDED.ADMIN_EMAIL,
      ROLES_SEEDED.ADMIN_PASSWORD,
    );

    const res = await request(context.httpServer)
      .get('/permissions')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBe(23);
    expect(
      res.body.some(
        (permission: { code: string }) => permission.code === 'MANAGE_ROLES',
      ),
    ).toBe(true);
  });

  it('GET /permissions com usuário is_admin SEM a permissão → 200 (bypass — ADR 0004 §2)', async () => {
    await context.seedAdminUserWithoutPermissions('admin-bypass@teste.local');

    const token = await context.loginAndGetToken(
      'admin-bypass@teste.local',
      ROLES_SEEDED.ADMIN_PASSWORD,
    );

    const res = await request(context.httpServer)
      .get('/permissions')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(Array.isArray(res.body)).toBe(true);
  });

  it('GET /permissions com usuário comum (Porteiro, sem MANAGE_ROLES) → 403', async () => {
    await context.seedUserWithRole(
      'porteiro@teste.local',
      ROLES_SEEDED.PORTEIRO_ROLE_ID,
    );

    const token = await context.loginAndGetToken(
      'porteiro@teste.local',
      ROLES_SEEDED.ADMIN_PASSWORD,
    );

    await request(context.httpServer)
      .get('/permissions')
      .set('Authorization', `Bearer ${token}`)
      .expect(403);
  });

  it('GET /permissions sem token → 401', async () => {
    await request(context.httpServer).get('/permissions').expect(401);
  });
});
