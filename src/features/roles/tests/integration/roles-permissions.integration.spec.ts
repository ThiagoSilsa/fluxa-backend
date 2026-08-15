// Supertest
import request from 'supertest';

// Support
import {
  createRolesIntegrationContext,
  ROLES_SEEDED,
  RolesIntegrationContext,
} from './support/roles-integration-context';

jest.setTimeout(120000);

describe('Roles integration — vínculo role_permission (Testcontainers)', () => {
  let context: RolesIntegrationContext;
  let token: string;
  let roleId: string;
  let permissionId: string;

  beforeAll(async () => {
    context = await createRolesIntegrationContext();
    token = await context.loginAndGetToken(
      ROLES_SEEDED.ADMIN_EMAIL,
      ROLES_SEEDED.ADMIN_PASSWORD,
    );

    const created = await request(context.httpServer)
      .post('/roles')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Cargo com Permissões' })
      .expect(201);
    roleId = created.body.id;

    const found = await context.findPermissionIdByCode('REGISTER_ENTRY');
    if (!found) {
      throw new Error('Permissão REGISTER_ENTRY não encontrada no catálogo.');
    }
    permissionId = found;
  });

  afterAll(async () => {
    await context.close();
  });

  it('POST /roles/:id/permissions associa (201)', async () => {
    const res = await request(context.httpServer)
      .post(`/roles/${roleId}/permissions`)
      .set('Authorization', `Bearer ${token}`)
      .send({ permissionId })
      .expect(201);

    expect(res.body).toMatchObject({ code: 'REGISTER_ENTRY' });
  });

  it('associação duplicada → 409', async () => {
    await request(context.httpServer)
      .post(`/roles/${roleId}/permissions`)
      .set('Authorization', `Bearer ${token}`)
      .send({ permissionId })
      .expect(409);
  });

  it('permissão inexistente → 404', async () => {
    await request(context.httpServer)
      .post(`/roles/${roleId}/permissions`)
      .set('Authorization', `Bearer ${token}`)
      .send({ permissionId: '00000000-0000-0000-0000-000000000000' })
      .expect(404);
  });

  it('cargo inexistente → 404', async () => {
    await request(context.httpServer)
      .post('/roles/00000000-0000-0000-0000-000000000000/permissions')
      .set('Authorization', `Bearer ${token}`)
      .send({ permissionId })
      .expect(404);
  });

  it('GET /roles/:id/permissions devolve vinculadas + catálogo disponível', async () => {
    const res = await request(context.httpServer)
      .get(`/roles/${roleId}/permissions`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(res.body.roleId).toBe(roleId);
    expect(
      res.body.permissions.some(
        (permission: { code: string }) => permission.code === 'REGISTER_ENTRY',
      ),
    ).toBe(true);
    expect(res.body.available.length).toBeGreaterThan(0);
  });

  it('DELETE /roles/:id/permissions/:permissionId remove (204)', async () => {
    await request(context.httpServer)
      .delete(`/roles/${roleId}/permissions/${permissionId}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(204);

    const res = await request(context.httpServer)
      .get(`/roles/${roleId}/permissions`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(
      res.body.permissions.some(
        (permission: { code: string }) => permission.code === 'REGISTER_ENTRY',
      ),
    ).toBe(false);
  });
});
