// Supertest
import request from 'supertest';

// Support
import {
  createUsersIntegrationContext,
  USERS_SEEDED,
  UsersIntegrationContext,
} from './support/users-integration-context';

jest.setTimeout(120000);

describe('Users integration — email-status (Testcontainers)', () => {
  let context: UsersIntegrationContext;
  let token: string;

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

  it('devolve { exists: true } para e-mail existente', async () => {
    const res = await request(context.httpServer)
      .get('/users/email-status')
      .set('Authorization', `Bearer ${token}`)
      .query({ email: USERS_SEEDED.ADMIN_EMAIL })
      .expect(200);

    expect(res.body).toEqual({ exists: true });
  });

  it('devolve { exists: false } para e-mail inexistente', async () => {
    const res = await request(context.httpServer)
      .get('/users/email-status')
      .set('Authorization', `Bearer ${token}`)
      .query({ email: 'nobody@somar.local' })
      .expect(200);

    expect(res.body).toEqual({ exists: false });
  });

  it('devolve apenas a chave exists (não vaza nome/empresas)', async () => {
    const res = await request(context.httpServer)
      .get('/users/email-status')
      .set('Authorization', `Bearer ${token}`)
      .query({ email: USERS_SEEDED.ADMIN_EMAIL })
      .expect(200);

    expect(Object.keys(res.body)).toEqual(['exists']);
  });

  it('401 sem token', async () => {
    await request(context.httpServer)
      .get('/users/email-status')
      .query({ email: USERS_SEEDED.ADMIN_EMAIL })
      .expect(401);
  });

  it('403 sem MANAGE_USERS (Porteiro)', async () => {
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
      .get('/users/email-status')
      .set('Authorization', `Bearer ${porteiroToken}`)
      .query({ email: USERS_SEEDED.ADMIN_EMAIL })
      .expect(403);
  });
});
