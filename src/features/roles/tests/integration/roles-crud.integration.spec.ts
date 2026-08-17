// Supertest
import request from 'supertest';

// Support
import {
  createRolesIntegrationContext,
  ROLES_SEEDED,
  RolesIntegrationContext,
} from './support/roles-integration-context';

jest.setTimeout(120000);

describe('Roles integration — CRUD de cargos (Testcontainers)', () => {
  let context: RolesIntegrationContext;
  let token: string;

  beforeAll(async () => {
    context = await createRolesIntegrationContext();
    token = await context.loginAndGetToken(
      ROLES_SEEDED.ADMIN_EMAIL,
      ROLES_SEEDED.ADMIN_PASSWORD,
    );
  });

  afterAll(async () => {
    await context.close();
  });

  it('POST /roles cria um cargo não-admin', async () => {
    const res = await request(context.httpServer)
      .post('/roles')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Vigia Noturno', description: 'Turno da noite' })
      .expect(201);

    expect(res.body).toMatchObject({
      name: 'Vigia Noturno',
      description: 'Turno da noite',
      isAdmin: false,
      isActive: true,
    });
    expect(typeof res.body.id).toBe('string');
  });

  it('POST /roles rejeita isAdmin true (400 — ADR 0004)', async () => {
    await request(context.httpServer)
      .post('/roles')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Admin', isAdmin: true })
      .expect(400);
  });

  it('GET /roles devolve lista paginada no formato padrão', async () => {
    const res = await request(context.httpServer)
      .get('/roles')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(res.body).toMatchObject({ limit: 20, offset: 0 });
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(typeof res.body.count).toBe('number');
    expect(res.body.data.length).toBeGreaterThan(0);
  });

  it('GET /roles/:id detalha um cargo', async () => {
    const created = await request(context.httpServer)
      .post('/roles')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Consultor' })
      .expect(201);

    const res = await request(context.httpServer)
      .get(`/roles/${created.body.id}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(res.body).toMatchObject({ id: created.body.id, name: 'Consultor' });
  });

  it('PATCH /roles/:id atualiza nome/descrição', async () => {
    const created = await request(context.httpServer)
      .post('/roles')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Vigia' })
      .expect(201);

    const res = await request(context.httpServer)
      .patch(`/roles/${created.body.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Vigia Diurno', description: 'Turno do dia' })
      .expect(200);

    expect(res.body).toMatchObject({
      name: 'Vigia Diurno',
      description: 'Turno do dia',
    });
  });

  it('PATCH /roles/:id desativa e reativa via isActive', async () => {
    const created = await request(context.httpServer)
      .post('/roles')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Plantão' })
      .expect(201);

    const deactivated = await request(context.httpServer)
      .patch(`/roles/${created.body.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ isActive: false })
      .expect(200);

    expect(deactivated.body).toMatchObject({
      id: created.body.id,
      isActive: false,
    });

    const reactivated = await request(context.httpServer)
      .patch(`/roles/${created.body.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ isActive: true })
      .expect(200);

    expect(reactivated.body).toMatchObject({
      id: created.body.id,
      isActive: true,
    });
  });

  it('DELETE /roles/:id exclui fisicamente o cargo (204) e ele some', async () => {
    const created = await request(context.httpServer)
      .post('/roles')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Temporário' })
      .expect(201);

    await request(context.httpServer)
      .delete(`/roles/${created.body.id}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(204);

    await request(context.httpServer)
      .get(`/roles/${created.body.id}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(404);
  });

  it('GET /roles?isActive=false devolve apenas cargos inativos', async () => {
    const created = await request(context.httpServer)
      .post('/roles')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Filtro Status' })
      .expect(201);

    await request(context.httpServer)
      .patch(`/roles/${created.body.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ isActive: false })
      .expect(200);

    const inactive = await request(context.httpServer)
      .get('/roles?isActive=false')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(
      inactive.body.data.some(
        (role: { id: string }) => role.id === created.body.id,
      ),
    ).toBe(true);
    expect(
      inactive.body.data.every(
        (role: { isActive: boolean }) => role.isActive === false,
      ),
    ).toBe(true);

    const active = await request(context.httpServer)
      .get('/roles?isActive=true')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(
      active.body.data.some(
        (role: { id: string }) => role.id === created.body.id,
      ),
    ).toBe(false);
  });

  it('DELETE /roles/:id em cascata remove role_permission e desvincula user_role', async () => {
    const created = await request(context.httpServer)
      .post('/roles')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Cargo em Cascata' })
      .expect(201);
    const roleId = created.body.id;

    const permissionId = await context.findPermissionIdByCode('REGISTER_ENTRY');
    if (!permissionId) {
      throw new Error('Permissão REGISTER_ENTRY não encontrada no catálogo.');
    }
    await request(context.httpServer)
      .post(`/roles/${roleId}/permissions`)
      .set('Authorization', `Bearer ${token}`)
      .send({ permissionId })
      .expect(201);

    await context.seedUserWithRole('cascata@somar.local', roleId);

    const before = await context.dataSource.query(
      `SELECT COUNT(*)::int AS total FROM "role_permission" WHERE "role_id" = $1`,
      [roleId],
    );
    expect(before[0].total).toBe(1);
    const userBefore = await context.dataSource.query(
      `SELECT COUNT(*)::int AS total FROM "user_role" WHERE "role_id" = $1`,
      [roleId],
    );
    expect(userBefore[0].total).toBe(1);

    await request(context.httpServer)
      .delete(`/roles/${roleId}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(204);

    const after = await context.dataSource.query(
      `SELECT COUNT(*)::int AS total FROM "role_permission" WHERE "role_id" = $1`,
      [roleId],
    );
    expect(after[0].total).toBe(0);
    const userAfter = await context.dataSource.query(
      `SELECT COUNT(*)::int AS total FROM "user_role" WHERE "role_id" = $1`,
      [roleId],
    );
    expect(userAfter[0].total).toBe(0);

    await request(context.httpServer)
      .get(`/roles/${roleId}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(404);
  });

  it('PATCH e DELETE rejeitam o cargo seedado Administração (is_admin — ADR 0004)', async () => {
    await request(context.httpServer)
      .patch(`/roles/${ROLES_SEEDED.ADMIN_ROLE_ID}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Outro' })
      .expect(400);

    await request(context.httpServer)
      .delete(`/roles/${ROLES_SEEDED.ADMIN_ROLE_ID}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(400);
  });

  it('GET /roles/:id inexistente → 404', async () => {
    await request(context.httpServer)
      .get('/roles/00000000-0000-0000-0000-000000000000')
      .set('Authorization', `Bearer ${token}`)
      .expect(404);
  });

  it('rotas sem token → 401', async () => {
    await request(context.httpServer).get('/roles').expect(401);
  });
});
