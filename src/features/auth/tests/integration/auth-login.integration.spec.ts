import { EventEmitter2 } from '@nestjs/event-emitter';
import request from 'supertest';
import {
  AUTH_SEEDED,
  AuthIntegrationContext,
  createAuthIntegrationContext,
} from './support/auth-integration-context';

jest.setTimeout(120000);

describe('Auth integration — login (Testcontainers)', () => {
  let context: AuthIntegrationContext;

  beforeAll(async () => {
    context = await createAuthIntegrationContext();
  });

  // O teto do login é por e-mail/IP (ADR 0003): um teste que entra dezenas de
  // vezes com a mesma conta em segundos estouraria o limite sem que nada
  // estivesse errado.
  beforeEach(() => {
    context.resetThrottle();
  });

  it('login correto (1 empresa) → 200 com sessão JWT', async () => {
    const res = await request(context.httpServer)
      .post('/auth/login')
      .send({
        email: AUTH_SEEDED.ADMIN_EMAIL,
        password: AUTH_SEEDED.ADMIN_PASSWORD,
      })
      .expect(200);

    expect(res.body).toMatchObject({
      tokenType: 'Bearer',
      expiresIn: 28800,
      user: { email: AUTH_SEEDED.ADMIN_EMAIL, type: 'EMPLOYEE' },
    });
    expect(typeof res.body.accessToken).toBe('string');
  });

  it('login grava user.last_login_at (ADR 0003)', async () => {
    await request(context.httpServer)
      .post('/auth/login')
      .send({
        email: AUTH_SEEDED.ADMIN_EMAIL,
        password: AUTH_SEEDED.ADMIN_PASSWORD,
      })
      .expect(200);

    const rows = await context.dataSource.query(
      `SELECT "last_login_at" FROM "user" WHERE "id" = $1`,
      [AUTH_SEEDED.ADMIN_USER_ID],
    );
    expect(rows[0]?.last_login_at).toBeDefined();
  });

  it('login emite user.logged_in (ADR 0003)', async () => {
    const spy = jest.spyOn(context.app.get(EventEmitter2), 'emit');

    try {
      await request(context.httpServer)
        .post('/auth/login')
        .send({
          email: AUTH_SEEDED.ADMIN_EMAIL,
          password: AUTH_SEEDED.ADMIN_PASSWORD,
        })
        .expect(200);

      expect(spy).toHaveBeenCalledWith(
        'user.logged_in',
        expect.objectContaining({
          userId: AUTH_SEEDED.ADMIN_USER_ID,
          companyId: AUTH_SEEDED.SOMAR_COMPANY_ID,
        }),
      );
    } finally {
      spy.mockRestore();
    }
  });

  it('senha errada → 401 indistinguível', async () => {
    await request(context.httpServer)
      .post('/auth/login')
      .send({ email: AUTH_SEEDED.ADMIN_EMAIL, password: 'senha-errada' })
      .expect(401);
  });

  it('email inexistente → 401 indistinguível', async () => {
    await request(context.httpServer)
      .post('/auth/login')
      .send({
        email: 'nobody@somar.local',
        password: AUTH_SEEDED.ADMIN_PASSWORD,
      })
      .expect(401);
  });

  afterAll(async () => {
    await context.close();
  });
});
