import { Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { ThrottlerModule } from '@nestjs/throttler';
import type { Server } from 'node:http';
import request from 'supertest';
import { loginEmailTracker } from '../src/shared/throttler/login-throttle.options';
import { ThrottleLogin } from '../src/shared/throttler/throttle-login.decorator';

/**
 * Controller de teste para validar o `@ThrottleLogin()` por HTTP (ADR 0003).
 *
 * Rota pública que apenas responde 200 — o que importa é o guard de rate
 * limiting aplicado pelo decorator. Sem banco (o teste não usa o AppModule).
 */
@Controller('throttle-test')
class ThrottleTestController {
  /**
   * Rota protegida pelo rate limiting do login.
   *
   * @returns Confirmação simples.
   */
  @Post()
  @HttpCode(HttpStatus.OK)
  @ThrottleLogin()
  public ping(): { ok: boolean } {
    return { ok: true };
  }
}

/**
 * E2E do rate limiting do login (ADR 0003) — sem banco.
 *
 * Valida a fiação completa (`@ThrottleLogin()` → `LoginThrottleGuard` →
 * `ThrottlerModule`) por HTTP com limites reduzidos, usando um app mínimo.
 */
describe('Login throttling (e2e — ADR 0003)', () => {
  it('429 após exceder o limite por IP (e-mails distintos)', async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [
        ThrottlerModule.forRoot({
          throttlers: [
            { name: 'default', limit: 3, ttl: 60_000 },
            {
              name: 'email',
              limit: 10,
              ttl: 60_000,
              getTracker: loginEmailTracker,
            },
          ],
        }),
      ],
      controllers: [ThrottleTestController],
    }).compile();

    const app = moduleRef.createNestApplication();
    await app.init();

    const server = app.getHttpServer() as Server;
    for (let i = 0; i < 3; i++) {
      await request(server)
        .post('/throttle-test')
        .send({ email: `user${i}@somar.local` })
        .expect(200);
    }

    // Mesmo IP (127.0.0.1), e-mail novo: estoura a dimensão por IP.
    await request(server)
      .post('/throttle-test')
      .send({ email: 'user3@somar.local' })
      .expect(429);

    await app.close();
  });

  it('429 após exceder o limite por e-mail (mesmo e-mail)', async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [
        ThrottlerModule.forRoot({
          throttlers: [
            { name: 'default', limit: 10, ttl: 60_000 },
            {
              name: 'email',
              limit: 2,
              ttl: 60_000,
              getTracker: loginEmailTracker,
            },
          ],
        }),
      ],
      controllers: [ThrottleTestController],
    }).compile();

    const app = moduleRef.createNestApplication();
    await app.init();

    const server = app.getHttpServer() as Server;
    await request(server)
      .post('/throttle-test')
      .send({ email: 'alvo@somar.local' })
      .expect(200);
    await request(server)
      .post('/throttle-test')
      .send({ email: 'alvo@somar.local' })
      .expect(200);

    // Mesmo e-mail pela 3ª vez: estoura a dimensão por e-mail.
    await request(server)
      .post('/throttle-test')
      .send({ email: 'alvo@somar.local' })
      .expect(429);

    await app.close();
  });
});
