// NestJS
import request from 'supertest';

// Support
import {
  AUTH_SEEDED,
  AuthIntegrationContext,
  createAuthIntegrationContext,
} from './support/auth-integration-context';

jest.setTimeout(120000);

describe('Auth integration — login multi-empresa (ADR 0002)', () => {
  let context: AuthIntegrationContext;

  beforeAll(async () => {
    context = await createAuthIntegrationContext({ seedSecondCompany: true });
  });

  beforeEach(() => {
    context.resetThrottle();
  });

  it('login sem companyId → requiresCompanyChoice com as 2 empresas', async () => {
    const res = await request(context.httpServer)
      .post('/auth/login')
      .send({
        email: AUTH_SEEDED.ADMIN_EMAIL,
        password: AUTH_SEEDED.ADMIN_PASSWORD,
      })
      .expect(200);

    expect(res.body.requiresCompanyChoice).toBe(true);
    expect(res.body.companies).toEqual(
      expect.arrayContaining([
        { id: AUTH_SEEDED.SOMAR_COMPANY_ID, name: 'SOMAR' },
        { id: AUTH_SEEDED.SECOND_COMPANY_ID, name: 'Autarquia B' },
      ]),
    );
  });

  it('login com companyId → sessão na empresa escolhida', async () => {
    const res = await request(context.httpServer)
      .post('/auth/login')
      .send({
        email: AUTH_SEEDED.ADMIN_EMAIL,
        password: AUTH_SEEDED.ADMIN_PASSWORD,
        companyId: AUTH_SEEDED.SECOND_COMPANY_ID,
      })
      .expect(200);

    expect(res.body.accessToken).toBeDefined();
  });

  afterAll(async () => {
    await context.close();
  });
});
