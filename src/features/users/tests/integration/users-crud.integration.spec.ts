// Supertest
import request from 'supertest';

// Support
import {
  createUsersIntegrationContext,
  USERS_SEEDED,
  UsersIntegrationContext,
} from './support/users-integration-context';

jest.setTimeout(120000);

describe('Users integration — CRUD (Testcontainers)', () => {
  let context: UsersIntegrationContext;
  let token: string;
  let porteiroId: string | null;

  const createUser = (
    email: string,
    name: string,
    password = 'senha123',
  ): request.Test =>
    request(context.httpServer)
      .post('/users')
      .set('Authorization', `Bearer ${token}`)
      .send({ name, email, password, type: 'EMPLOYEE' });

  /** Envia apenas e-mail + type — para vincular pessoa já existente. */
  const linkUser = (email: string): request.Test =>
    request(context.httpServer)
      .post('/users')
      .set('Authorization', `Bearer ${token}`)
      .send({ email, type: 'EMPLOYEE' });

  beforeAll(async () => {
    context = await createUsersIntegrationContext();
    token = await context.loginAndGetToken(
      USERS_SEEDED.ADMIN_EMAIL,
      USERS_SEEDED.ADMIN_PASSWORD,
    );
    porteiroId = await context.findRoleIdByName('Porteiro');
  });

  afterAll(async () => {
    await context.close();
  });

  it('POST /users cria pessoa nova já vinculada (createdUser true)', async () => {
    const res = await createUser('novo@somar.local', 'Novo Funcionário')
      .send({ phone: '11999999999' })
      .expect(201);

    expect(res.body).toMatchObject({
      name: 'Novo Funcionário',
      email: 'novo@somar.local',
      phone: '11999999999',
      type: 'EMPLOYEE',
      isActive: true,
      createdUser: true,
    });
    expect(typeof res.body.id).toBe('string');
  });

  it('POST /users cria pessoa nova já com cargo (roleId)', async () => {
    const res = await request(context.httpServer)
      .post('/users')
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: 'Com Cargo',
        email: 'comcargo@somar.local',
        password: 'senha123',
        type: 'EMPLOYEE',
        roleId: porteiroId,
      })
      .expect(201);

    expect(res.body).toMatchObject({
      createdUser: true,
      role: { roleId: porteiroId, roleName: 'Porteiro', isAdmin: false },
    });

    // O cargo aparece no detalhe e na listagem (resumo sem N+1).
    const detail = await request(context.httpServer)
      .get(`/users/${res.body.id}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(detail.body.role).toMatchObject({ roleId: porteiroId });

    const list = await request(context.httpServer)
      .get('/users')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    const found = list.body.data.find(
      (user: { id: string }) => user.id === res.body.id,
    );
    expect(found.role).toMatchObject({
      roleId: porteiroId,
      roleName: 'Porteiro',
    });
  });

  it('POST /users vincula pessoa existente já com cargo (roleId)', async () => {
    const secondUserId = await context.seedUserInSecondCompany(
      'maria-role@outra.local',
    );

    const res = await request(context.httpServer)
      .post('/users')
      .set('Authorization', `Bearer ${token}`)
      .send({
        email: 'maria-role@outra.local',
        type: 'EMPLOYEE',
        roleId: porteiroId,
      })
      .expect(201);

    expect(res.body).toMatchObject({
      id: secondUserId,
      createdUser: false,
      role: { roleId: porteiroId, roleName: 'Porteiro', isAdmin: false },
    });
  });

  it('POST /users com roleId fora da empresa → 404', async () => {
    await request(context.httpServer)
      .post('/users')
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: 'Sem Cargo',
        email: 'semcargo@somar.local',
        password: 'senha123',
        type: 'EMPLOYEE',
        roleId: 'ffffffff-0000-0000-0000-000000000000',
      })
      .expect(404);
  });

  it('POST /users vincula pessoa existente em outra empresa (createdUser false)', async () => {
    const secondUserId =
      await context.seedUserInSecondCompany('maria@outra.local');

    const res = await linkUser('maria@outra.local').expect(201);

    expect(res.body).toMatchObject({
      id: secondUserId,
      email: 'maria@outra.local',
      createdUser: false,
      isActive: true,
    });
  });

  it('POST /users rejeita dados da pessoa no vínculo (400)', async () => {
    await context.seedUserInSecondCompany('maria2@outra.local');

    await createUser('maria2@outra.local', 'Outro Nome').expect(400);
  });

  it('POST /users rejeita vínculo já existente na mesma empresa (409)', async () => {
    await linkUser(USERS_SEEDED.ADMIN_EMAIL).expect(409);
  });

  it('POST /users rejeita documento de outra pessoa (409)', async () => {
    await createUser('primeira@somar.local', 'Primeira')
      .send({ document: '11111111111' })
      .expect(201);

    await createUser('segunda@somar.local', 'Segunda')
      .send({ document: '11111111111' })
      .expect(409);
  });

  it('GET /users devolve lista paginada no formato padrão', async () => {
    const res = await request(context.httpServer)
      .get('/users')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(res.body).toMatchObject({ limit: 20, offset: 0 });
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(typeof res.body.count).toBe('number');
    expect(res.body.data.length).toBeGreaterThan(0);
    // Cada item traz o resumo do cargo (null quando sem cargo).
    expect(res.body.data[0]).toHaveProperty('role');
  });

  it('GET /users/:id detalha um usuário da empresa', async () => {
    const created = await createUser('detalhe@somar.local', 'Detalhe').expect(
      201,
    );

    const res = await request(context.httpServer)
      .get(`/users/${created.body.id}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(res.body).toMatchObject({ id: created.body.id, name: 'Detalhe' });
  });

  it('GET /users/:id devolve 404 para pessoa sem vínculo com a empresa', async () => {
    const secondUserId =
      await context.seedUserInSecondCompany('fora@somar.local');

    await request(context.httpServer)
      .get(`/users/${secondUserId}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(404);
  });

  it('normaliza e-mail em caixa mista (cria e consulta igual)', async () => {
    await createUser('  Caixa@Somar.Local ', 'Caixa').expect(201);

    const res = await request(context.httpServer)
      .get('/users/email-status')
      .set('Authorization', `Bearer ${token}`)
      .query({ email: 'caixa@somar.local' })
      .expect(200);

    expect(res.body).toEqual({ exists: true });
  });

  it('401 sem token e 403 sem MANAGE_USERS', async () => {
    await request(context.httpServer).get('/users').expect(401);

    const porteiroId = await context.findRoleIdByName('Porteiro');
    const porteiroEmail = 'porteiro@somar.local';
    if (porteiroId) {
      await context.seedUserWithRole(porteiroEmail, porteiroId);
    }
    const porteiroToken = await context.loginAndGetToken(
      porteiroEmail,
      USERS_SEEDED.ADMIN_PASSWORD,
    );

    await request(context.httpServer)
      .get('/users')
      .set('Authorization', `Bearer ${porteiroToken}`)
      .expect(403);
  });
});
