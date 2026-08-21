// Supertest
import request from 'supertest';

// Support
import {
  createUsersIntegrationContext,
  USERS_SEEDED,
  UsersIntegrationContext,
} from './support/users-integration-context';

jest.setTimeout(120000);

describe('Users integration — troca de senha (Testcontainers)', () => {
  let context: UsersIntegrationContext;
  let token: string;

  const createUser = (
    email: string,
    name: string,
    password = 'senha123',
  ): request.Test =>
    request(context.httpServer)
      .post('/users')
      .set('Authorization', `Bearer ${token}`)
      .send({ name, email, password, type: 'EMPLOYEE' });

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

  it('troca a senha e o login passa a aceitar a nova (e recusar a antiga)', async () => {
    const created = await createUser('senha@somar.local', 'Senha').expect(201);

    // Login com a senha original funciona.
    await context.loginAndGetToken('senha@somar.local', 'senha123');

    await request(context.httpServer)
      .patch(`/users/${created.body.id}/password`)
      .set('Authorization', `Bearer ${token}`)
      .send({ newPassword: 'nova123' })
      .expect(204);

    // Login com a nova funciona; com a antiga falha.
    await context.loginAndGetToken('senha@somar.local', 'nova123');
    await expect(
      context.loginAndGetToken('senha@somar.local', 'senha123'),
    ).rejects.toThrow();
  });

  it('rejeita senha com menos de 6 caracteres (400)', async () => {
    const created = await createUser('curta@somar.local', 'Curta').expect(201);

    await request(context.httpServer)
      .patch(`/users/${created.body.id}/password`)
      .set('Authorization', `Bearer ${token}`)
      .send({ newPassword: '123' })
      .expect(400);
  });

  it('404 para usuário sem vínculo com a empresa da sessão', async () => {
    const secondUserId = await context.seedUserInSecondCompany(
      'fora-senha@somar.local',
    );

    await request(context.httpServer)
      .patch(`/users/${secondUserId}/password`)
      .set('Authorization', `Bearer ${token}`)
      .send({ newPassword: 'nova123' })
      .expect(404);
  });

  it('gestor (sem is_admin) não troca a senha de um admin → 403', async () => {
    const gestorToken = await seedGestorToken('gestor@somar.local');

    await request(context.httpServer)
      .patch(`/users/${USERS_SEEDED.ADMIN_USER_ID}/password`)
      .set('Authorization', `Bearer ${gestorToken}`)
      .send({ newPassword: 'nova123' })
      .expect(403);
  });

  it('gestor troca a senha de um usuário comum (204)', async () => {
    const gestorToken = await seedGestorToken('gestor2@somar.local');
    const created = await createUser('comum-senha@somar.local', 'Comum').expect(
      201,
    );

    await request(context.httpServer)
      .patch(`/users/${created.body.id}/password`)
      .set('Authorization', `Bearer ${gestorToken}`)
      .send({ newPassword: 'nova123' })
      .expect(204);
  });
});
