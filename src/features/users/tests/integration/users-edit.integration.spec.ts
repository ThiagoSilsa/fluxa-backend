// Supertest
import request from 'supertest';

// Support
import {
  createUsersIntegrationContext,
  USERS_SEEDED,
  UsersIntegrationContext,
} from './support/users-integration-context';

jest.setTimeout(120000);

describe('Users integration — edição/desativação (Testcontainers)', () => {
  let context: UsersIntegrationContext;
  let token: string;

  const createUser = (email: string, name: string): request.Test =>
    request(context.httpServer)
      .post('/users')
      .set('Authorization', `Bearer ${token}`)
      .send({ name, email, password: 'senha123', type: 'EMPLOYEE' });

  /**
   * Cria um cargo com a permissão `MANAGE_USERS` e um usuário vinculado —
   * gestor que gerencia usuários **sem** ser administrador.
   *
   * @param email E-mail do gestor.
   * @returns Token do gestor.
   */
  const seedGestorToken = async (email: string): Promise<string> => {
    const roleRes = await request(context.httpServer)
      .post('/roles')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Gestor de Usuários' })
      .expect(201);
    const roleId = roleRes.body.id;

    const permissionId = await context.findPermissionIdByCode('MANAGE_USERS');
    await request(context.httpServer)
      .post(`/roles/${roleId}/permissions`)
      .set('Authorization', `Bearer ${token}`)
      .send({ permissionId })
      .expect(201);

    await context.seedUserWithRole(email, roleId);
    return context.loginAndGetToken(email, USERS_SEEDED.ADMIN_PASSWORD);
  };

  beforeAll(async () => {
    context = await createUsersIntegrationContext();
    token = await context.loginAndGetToken(
      USERS_SEEDED.ADMIN_EMAIL,
      USERS_SEEDED.ADMIN_PASSWORD,
    );
  });

  afterAll(async () => {
    await context.close();
  });

  it('PATCH /users/:id edita parcialmente (nome)', async () => {
    const created = await createUser('edita@somar.local', 'Edita').expect(201);

    const res = await request(context.httpServer)
      .patch(`/users/${created.body.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Edita Silva' })
      .expect(200);

    expect(res.body).toMatchObject({
      id: created.body.id,
      name: 'Edita Silva',
    });
  });

  it('PATCH e-mail para endereço de outra pessoa → 409', async () => {
    const a = await createUser('a@somar.local', 'A').expect(201);
    await createUser('b@somar.local', 'B').expect(201);

    await request(context.httpServer)
      .patch(`/users/${a.body.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ email: 'b@somar.local' })
      .expect(409);
  });

  it('PATCH isActive false desativa o vínculo e true reativa', async () => {
    const created = await createUser('toggle@somar.local', 'Toggle').expect(
      201,
    );

    const off = await request(context.httpServer)
      .patch(`/users/${created.body.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ isActive: false })
      .expect(200);
    expect(off.body.isActive).toBe(false);

    const on = await request(context.httpServer)
      .patch(`/users/${created.body.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ isActive: true })
      .expect(200);
    expect(on.body.isActive).toBe(true);
  });

  it('DELETE /users/:id desativa (soft) um usuário comum', async () => {
    const created = await createUser('deleto@somar.local', 'Deleto').expect(
      201,
    );

    const res = await request(context.httpServer)
      .delete(`/users/${created.body.id}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(res.body).toMatchObject({ id: created.body.id, isActive: false });
  });

  it('DELETE do último admin ativo → 409 (invariante)', async () => {
    await request(context.httpServer)
      .delete(`/users/${USERS_SEEDED.ADMIN_USER_ID}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(409);
  });

  it('gestor (MANAGE_USERS, sem is_admin) não edita usuário admin → 403', async () => {
    const gestorToken = await seedGestorToken('gestor@somar.local');

    await request(context.httpServer)
      .patch(`/users/${USERS_SEEDED.ADMIN_USER_ID}`)
      .set('Authorization', `Bearer ${gestorToken}`)
      .send({ name: 'Inválido' })
      .expect(403);
  });

  it('gestor pode editar um usuário comum (não admin)', async () => {
    const gestorToken = await seedGestorToken('gestor2@somar.local');
    const created = await createUser('comum@somar.local', 'Comum').expect(201);

    const res = await request(context.httpServer)
      .patch(`/users/${created.body.id}`)
      .set('Authorization', `Bearer ${gestorToken}`)
      .send({ name: 'Comum Editado' })
      .expect(200);

    expect(res.body).toMatchObject({ name: 'Comum Editado' });
  });
});
