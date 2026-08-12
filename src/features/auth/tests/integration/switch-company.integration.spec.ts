import { EventEmitter2 } from '@nestjs/event-emitter';
import request from 'supertest';
import {
  AUTH_SEEDED,
  AuthIntegrationContext,
  createAuthIntegrationContext,
} from './support/auth-integration-context';

jest.setTimeout(120000);

describe('Auth integration — switch-company (Testcontainers)', () => {
  let context: AuthIntegrationContext;
  let token: string;

  beforeAll(async () => {
    context = await createAuthIntegrationContext({ seedSecondCompany: true });

    context.resetThrottle();
    const login = await request(context.httpServer)
      .post('/auth/login')
      .send({
        email: AUTH_SEEDED.ADMIN_EMAIL,
        password: AUTH_SEEDED.ADMIN_PASSWORD,
        companyId: AUTH_SEEDED.SOMAR_COMPANY_ID,
      })
      .expect(200);
    token = login.body.accessToken as string;
  });

  beforeEach(() => {
    context.resetThrottle();
  });

  it('switch-company válido → 200 com token novo', async () => {
    const res = await request(context.httpServer)
      .post('/auth/switch-company')
      .set('Authorization', `Bearer ${token}`)
      .send({ companyId: AUTH_SEEDED.SECOND_COMPANY_ID })
      .expect(200);

    expect(res.body.accessToken).toBeDefined();
    expect(res.body.accessToken).not.toBe(token);
  });

  it('switch-company emite user.company_switched + user.logged_in (ADR 0003)', async () => {
    const spy = jest.spyOn(context.app.get(EventEmitter2), 'emit');

    try {
      await request(context.httpServer)
        .post('/auth/switch-company')
        .set('Authorization', `Bearer ${token}`)
        .send({ companyId: AUTH_SEEDED.SECOND_COMPANY_ID })
        .expect(200);

      expect(spy).toHaveBeenCalledWith(
        'user.company_switched',
        expect.objectContaining({
          userId: AUTH_SEEDED.ADMIN_USER_ID,
          fromCompanyId: AUTH_SEEDED.SOMAR_COMPANY_ID,
          toCompanyId: AUTH_SEEDED.SECOND_COMPANY_ID,
        }),
      );
      expect(spy).toHaveBeenCalledWith(
        'user.logged_in',
        expect.objectContaining({
          userId: AUTH_SEEDED.ADMIN_USER_ID,
          companyId: AUTH_SEEDED.SECOND_COMPANY_ID,
        }),
      );
    } finally {
      spy.mockRestore();
    }
  });

  it('switch-company para empresa sem vínculo → 401', async () => {
    await request(context.httpServer)
      .post('/auth/switch-company')
      .set('Authorization', `Bearer ${token}`)
      .send({ companyId: '00000000-0000-0000-0000-000000000000' })
      .expect(401);
  });

  it('switch-company sem token → 401', async () => {
    await request(context.httpServer)
      .post('/auth/switch-company')
      .send({ companyId: AUTH_SEEDED.SECOND_COMPANY_ID })
      .expect(401);
  });

  it('revalidação por requisição: desativar o vínculo derruba a sessão', async () => {
    const switched = await request(context.httpServer)
      .post('/auth/switch-company')
      .set('Authorization', `Bearer ${token}`)
      .send({ companyId: AUTH_SEEDED.SECOND_COMPANY_ID })
      .expect(200);
    const secondToken = switched.body.accessToken as string;

    // Funciona enquanto o vínculo existe...
    await request(context.httpServer)
      .get('/auth/companies')
      .set('Authorization', `Bearer ${secondToken}`)
      .expect(200);

    // ...e o mesmo token é recusado quando o vínculo é desativado.
    await context.dataSource.query(
      `UPDATE "user_company" SET "is_active" = false
       WHERE "user_id" = $1 AND "company_id" = $2`,
      [AUTH_SEEDED.ADMIN_USER_ID, AUTH_SEEDED.SECOND_COMPANY_ID],
    );

    await request(context.httpServer)
      .get('/auth/companies')
      .set('Authorization', `Bearer ${secondToken}`)
      .expect(401);
  });

  afterAll(async () => {
    await context.close();
  });
});
