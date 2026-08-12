import request from 'supertest';
import {
  AUTH_SEEDED,
  AuthIntegrationContext,
  createAuthIntegrationContext,
} from './support/auth-integration-context';

jest.setTimeout(120000);

describe('Auth integration — sessão: validate + companies (Testcontainers)', () => {
  let context: AuthIntegrationContext;
  let token: string;

  beforeAll(async () => {
    context = await createAuthIntegrationContext();
    token = await context.loginAndGetToken(
      AUTH_SEEDED.ADMIN_EMAIL,
      AUTH_SEEDED.ADMIN_PASSWORD,
    );
  });

  it('GET /auth/validate com token → 200 com dados da sessão (ADR 0003)', async () => {
    const res = await request(context.httpServer)
      .get('/auth/validate')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(res.body).toMatchObject({
      id: AUTH_SEEDED.ADMIN_USER_ID,
      companyId: AUTH_SEEDED.SOMAR_COMPANY_ID,
      email: AUTH_SEEDED.ADMIN_EMAIL,
      type: 'EMPLOYEE',
    });
    expect(Array.isArray(res.body.roleCodes)).toBe(true);
    expect(Array.isArray(res.body.permissions)).toBe(true);
  });

  it('GET /auth/validate sem token → 401', async () => {
    await request(context.httpServer).get('/auth/validate').expect(401);
  });

  it('GET /auth/validate com token inválido → 401', async () => {
    await request(context.httpServer)
      .get('/auth/validate')
      .set('Authorization', 'Bearer token-invalido')
      .expect(401);
  });

  it('GET /auth/companies com token → [SOMAR]', async () => {
    const res = await request(context.httpServer)
      .get('/auth/companies')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(res.body).toEqual([
      { id: AUTH_SEEDED.SOMAR_COMPANY_ID, name: 'SOMAR' },
    ]);
  });

  it('GET /auth/companies sem token → 401', async () => {
    await request(context.httpServer).get('/auth/companies').expect(401);
  });

  afterAll(async () => {
    await context.close();
  });
});
