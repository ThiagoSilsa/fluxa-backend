import type { TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { resetThrottle } from './reset-throttle';

/**
 * Abre sessão pelo `POST /auth/login` e devolve o `accessToken`.
 *
 * Quase todo contexto de integração de auth precisa disso; o helper zera o
 * rate limiting antes para não estourar o teto (10/min por e-mail).
 *
 * @param httpServer Servidor HTTP da aplicação de teste.
 * @param moduleFixture Módulo de teste compilado.
 * @returns Função que faz login e retorna o `accessToken`.
 */
export function createLoginAndGetToken(
  httpServer: Parameters<typeof request>[0],
  moduleFixture: TestingModule,
): (email: string, password: string) => Promise<string> {
  return async function loginAndGetToken(email, password) {
    resetThrottle(moduleFixture);
    const response = await request(httpServer)
      .post('/auth/login')
      .send({ email, password });

    if (response.status !== 200) {
      throw new Error(`Unexpected login status ${response.status}`);
    }
    const body: unknown = response.body;
    const accessToken =
      typeof body === 'object' && body !== null
        ? (body as Record<string, unknown>).accessToken
        : undefined;
    if (typeof accessToken !== 'string') {
      throw new Error('Expected accessToken string in /auth/login response');
    }
    return accessToken;
  };
}
