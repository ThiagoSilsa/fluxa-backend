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

  it('DELETE /roles/:id desativa (soft) um cargo', async () => {
    const created = await request(context.httpServer)
      .post('/roles')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Temporário' })
      .expect(201);

    const res = await request(context.httpServer)
      .delete(`/roles/${created.body.id}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(res.body).toMatchObject({ id: created.body.id, isActive: false });
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
