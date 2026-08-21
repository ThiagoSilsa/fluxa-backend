// Supertest
import request from 'supertest';

// Support
import {
  createEntrancesIntegrationContext,
  ENTRANCES_SEEDED,
  EntrancesIntegrationContext,
} from './support/entrances-integration-context';

jest.setTimeout(120000);

describe('Entrances integration — CRUD de portarias (Testcontainers)', () => {
  let context: EntrancesIntegrationContext;
  let token: string;
  let porteiroToken: string;

  beforeAll(async () => {
    context = await createEntrancesIntegrationContext();
    token = await context.loginAndGetToken(
      ENTRANCES_SEEDED.ADMIN_EMAIL,
      ENTRANCES_SEEDED.ADMIN_PASSWORD,
    );
    await context.seedUserWithRole(
      'porteiro@teste.local',
      ENTRANCES_SEEDED.PORTEIRO_ROLE_ID,
    );
    porteiroToken = await context.loginAndGetToken(
      'porteiro@teste.local',
      ENTRANCES_SEEDED.ADMIN_PASSWORD,
    );
  });

  afterAll(async () => {
    await context.close();
  });

  it('POST /entrances cria uma portaria', async () => {
    const res = await request(context.httpServer)
      .post('/entrances')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Portaria Principal' })
      .expect(201);

    expect(res.body).toMatchObject({
      name: 'Portaria Principal',
      isActive: true,
    });
    expect(typeof res.body.id).toBe('string');
  });

  it('GET /entrances devolve lista paginada no formato padrão', async () => {
    const res = await request(context.httpServer)
      .get('/entrances')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(res.body).toMatchObject({ limit: 20, offset: 0 });
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(typeof res.body.count).toBe('number');
  });

  it('GET /entrances/:id detalha uma portaria', async () => {
    const created = await request(context.httpServer)
      .post('/entrances')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Portaria Secundária' })
      .expect(201);

    const res = await request(context.httpServer)
      .get(`/entrances/${created.body.id}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(res.body).toMatchObject({
      id: created.body.id,
      name: 'Portaria Secundária',
    });
  });

  it('PATCH /entrances/:id atualiza o nome', async () => {
    const created = await request(context.httpServer)
      .post('/entrances')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Portaria A' })
      .expect(201);

    const res = await request(context.httpServer)
      .patch(`/entrances/${created.body.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Portaria B' })
      .expect(200);

    expect(res.body).toMatchObject({ name: 'Portaria B' });
  });

  it('DELETE exclui fisicamente (204) e GET :id → 404', async () => {
    const created = await request(context.httpServer)
      .post('/entrances')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Temporária' })
      .expect(201);

    await request(context.httpServer)
      .delete(`/entrances/${created.body.id}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(204);

    await request(context.httpServer)
      .get(`/entrances/${created.body.id}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(404);
  });

  it('PATCH isActive:false desativa e PATCH isActive:true reativa', async () => {
    const created = await request(context.httpServer)
      .post('/entrances')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Desativável' })
      .expect(201);

    const deactivated = await request(context.httpServer)
      .patch(`/entrances/${created.body.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ isActive: false })
      .expect(200);
    expect(deactivated.body).toMatchObject({ isActive: false });

    const reactivated = await request(context.httpServer)
      .patch(`/entrances/${created.body.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ isActive: true })
      .expect(200);
    expect(reactivated.body).toMatchObject({ isActive: true });
  });

  it('DELETE com dispositivos vinculados à portaria → 409 (bloqueio)', async () => {
    const created = await request(context.httpServer)
      .post('/entrances')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Em Uso' })
      .expect(201);

    // Insere um device (feature da semana 3+) vinculado à portaria.
    await context.dataSource.query(
      `INSERT INTO "device" ("company_id", "name", "token", "platform", "entrance_id")
       VALUES ($1, 'Device Teste', 'token-entrance-409', 'ANDROID', $2)`,
      [ENTRANCES_SEEDED.SOMAR_COMPANY_ID, created.body.id],
    );

    const res = await request(context.httpServer)
      .delete(`/entrances/${created.body.id}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(409);
    expect(res.body.message).toContain('em uso por dispositivos');

    // A portaria continua existindo (bloqueada, não removida).
    const stillThere = await request(context.httpServer)
      .get(`/entrances/${created.body.id}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(stillThere.body).toMatchObject({ name: 'Em Uso' });
  });

  it('GET /entrances/:id inexistente → 404', async () => {
    await request(context.httpServer)
      .get('/entrances/00000000-0000-0000-0000-000000000000')
      .set('Authorization', `Bearer ${token}`)
      .expect(404);
  });

  it('rotas sem token → 401', async () => {
    await request(context.httpServer).get('/entrances').expect(401);
  });

  it('usuário sem MANAGE_ENTRANCES → 403', async () => {
    await request(context.httpServer)
      .get('/entrances')
      .set('Authorization', `Bearer ${porteiroToken}`)
      .expect(403);
  });
});
