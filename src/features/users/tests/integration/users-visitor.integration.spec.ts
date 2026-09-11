// Supertest
import request from 'supertest';

// Support
import {
  createUsersIntegrationContext,
  USERS_SEEDED,
  UsersIntegrationContext,
} from './support/users-integration-context';

jest.setTimeout(120000);

/**
 * Credenciais por tipo de vínculo (ADR 0013): Visitante sem credenciais,
 * Colaborador exigindo e-mail + senha + cargo, promoção Visitante →
 * Colaborador e login sem senha (401).
 */
describe('Users integration — credenciais por tipo (ADR 0013)', () => {
  let context: UsersIntegrationContext;
  let token: string;
  let porteiroId: string | null;

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

  it('cria Visitante sem e-mail, senha e cargo (credenciais nulas)', async () => {
    const res = await request(context.httpServer)
      .post('/users')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Visitante Sem Credenciais', type: 'VISITOR' })
      .expect(201);

    expect(res.body).toMatchObject({
      name: 'Visitante Sem Credenciais',
      email: null,
      type: 'VISITOR',
      isActive: true,
      role: null,
      createdUser: true,
    });
  });

  it('Visitante com e-mail e sem senha não autentica (401)', async () => {
    await request(context.httpServer)
      .post('/users')
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: 'Visitante Com Email',
        email: 'visitor.sem.senha@somar.local',
        type: 'VISITOR',
      })
      .expect(201);

    await expect(
      context.loginAndGetToken('visitor.sem.senha@somar.local', 'qualquer123'),
    ).rejects.toThrow();
  });

  it('Colaborador sem e-mail → 400', async () => {
    await request(context.httpServer)
      .post('/users')
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: 'Colaborador Sem Email',
        password: 'senha123',
        type: 'EMPLOYEE',
        roleId: porteiroId,
      })
      .expect(400);
  });

  it('Colaborador sem senha → 400', async () => {
    await request(context.httpServer)
      .post('/users')
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: 'Colaborador Sem Senha',
        email: 'colab.sem.senha@somar.local',
        type: 'EMPLOYEE',
        roleId: porteiroId,
      })
      .expect(400);
  });

  it('Colaborador sem cargo → 400', async () => {
    await request(context.httpServer)
      .post('/users')
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: 'Colaborador Sem Cargo',
        email: 'colab.sem.cargo@somar.local',
        password: 'senha123',
        type: 'EMPLOYEE',
      })
      .expect(400);
  });

  it('promove Visitante → Colaborador exigindo e-mail, cargo e senha', async () => {
    const created = await request(context.httpServer)
      .post('/users')
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: 'Promover',
        email: 'promover@somar.local',
        type: 'VISITOR',
      })
      .expect(201);

    // Sem senha definida → 400.
    await request(context.httpServer)
      .patch(`/users/${created.body.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ type: 'EMPLOYEE', roleId: porteiroId })
      .expect(400);

    // Define a senha pelo fluxo próprio.
    await request(context.httpServer)
      .patch(`/users/${created.body.id}/password`)
      .set('Authorization', `Bearer ${token}`)
      .send({ newPassword: 'nova123' })
      .expect(204);

    // Sem cargo → 400.
    await request(context.httpServer)
      .patch(`/users/${created.body.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ type: 'EMPLOYEE' })
      .expect(400);

    // Com cargo → promove.
    const promoted = await request(context.httpServer)
      .patch(`/users/${created.body.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ type: 'EMPLOYEE', roleId: porteiroId })
      .expect(200);

    expect(promoted.body).toMatchObject({
      type: 'EMPLOYEE',
      role: { roleId: porteiroId },
    });

    // Passa a autenticar.
    await context.loginAndGetToken('promover@somar.local', 'nova123');
  });
});
