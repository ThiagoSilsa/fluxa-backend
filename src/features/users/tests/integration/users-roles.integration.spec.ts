// Supertest
import request from 'supertest';

// Support
import {
  createUsersIntegrationContext,
  USERS_SEEDED,
  UsersIntegrationContext,
} from './support/users-integration-context';

jest.setTimeout(120000);

describe('Users integration — cargos do usuário (Testcontainers)', () => {
  let context: UsersIntegrationContext;
  let token: string;
  let porteiroId: string | null;

  const createUser = (email: string, name: string): request.Test =>
    request(context.httpServer)
      .post('/users')
      .set('Authorization', `Bearer ${token}`)
      .send({ name, email, password: 'senha123', type: 'EMPLOYEE' });

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
    porteiroId = await context.findRoleIdByName('Porteiro');
  });

  afterAll(async () => {
    await context.close();
  });

  it('atribui, lista e remove um cargo do usuário', async () => {
    const created = await createUser('roles@somar.local', 'Roles').expect(201);

    await request(context.httpServer)
      .post(`/users/${created.body.id}/roles`)
      .set('Authorization', `Bearer ${token}`)
      .send({ roleId: porteiroId })
      .expect(201);

    const list = await request(context.httpServer)
      .get(`/users/${created.body.id}/roles`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(list.body.roles).toHaveLength(1);
    expect(list.body.roles[0]).toMatchObject({
      roleId: porteiroId,
      roleName: 'Porteiro',
    });

    await request(context.httpServer)
      .delete(`/users/${created.body.id}/roles/${porteiroId}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(204);

    const empty = await request(context.httpServer)
      .get(`/users/${created.body.id}/roles`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(empty.body.roles).toEqual([]);
  });

  it('duplicidade de cargo → 409', async () => {
    const created = await createUser('duplica@somar.local', 'Duplica').expect(
      201,
    );

    await request(context.httpServer)
      .post(`/users/${created.body.id}/roles`)
      .set('Authorization', `Bearer ${token}`)
      .send({ roleId: porteiroId })
      .expect(201);

    await request(context.httpServer)
      .post(`/users/${created.body.id}/roles`)
      .set('Authorization', `Bearer ${token}`)
      .send({ roleId: porteiroId })
      .expect(409);
  });

  it('segundo cargo (diferente) → 409 (um cargo por empresa)', async () => {
    const created = await createUser(
      'doiscargos@somar.local',
      'Dois Cargos',
    ).expect(201);

    await request(context.httpServer)
      .post(`/users/${created.body.id}/roles`)
      .set('Authorization', `Bearer ${token}`)
      .send({ roleId: porteiroId })
      .expect(201);

    await request(context.httpServer)
      .post(`/users/${created.body.id}/roles`)
      .set('Authorization', `Bearer ${token}`)
      .send({ roleId: USERS_SEEDED.ADMIN_ROLE_ID })
      .expect(409);
  });

  it('remover o cargo is_admin do último admin ativo → 409 (invariante)', async () => {
    await request(context.httpServer)
      .delete(
        `/users/${USERS_SEEDED.ADMIN_USER_ID}/roles/${USERS_SEEDED.ADMIN_ROLE_ID}`,
      )
      .set('Authorization', `Bearer ${token}`)
      .expect(409);
  });

  it('remover cargo não atribuído → 404', async () => {
    const created = await createUser('semrole@somar.local', 'Sem Role').expect(
      201,
    );

    await request(context.httpServer)
      .delete(`/users/${created.body.id}/roles/${porteiroId}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(404);
  });

  it('admin atribui cargo is_admin (Administração) a outro usuário', async () => {
    const created = await createUser(
      'novoadmin@somar.local',
      'Novo Admin',
    ).expect(201);

    await request(context.httpServer)
      .post(`/users/${created.body.id}/roles`)
      .set('Authorization', `Bearer ${token}`)
      .send({ roleId: USERS_SEEDED.ADMIN_ROLE_ID })
      .expect(201);
  });

  it('gestor não atribui cargo is_admin → 403', async () => {
    const gestorToken = await seedGestorToken('gestor@somar.local');
    const created = await createUser('alvo@somar.local', 'Alvo').expect(201);

    await request(context.httpServer)
      .post(`/users/${created.body.id}/roles`)
      .set('Authorization', `Bearer ${gestorToken}`)
      .send({ roleId: USERS_SEEDED.ADMIN_ROLE_ID })
      .expect(403);
  });

  it('gestor não gerencia cargos de um usuário admin → 403', async () => {
    const gestorToken = await seedGestorToken('gestor2@somar.local');

    await request(context.httpServer)
      .post(`/users/${USERS_SEEDED.ADMIN_USER_ID}/roles`)
      .set('Authorization', `Bearer ${gestorToken}`)
      .send({ roleId: porteiroId })
      .expect(403);
  });
});
