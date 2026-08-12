import type {
  ThrottlerGetTrackerFunction,
  ThrottlerModuleOptions,
} from '@nestjs/throttler';

/** Tentativas máximas por minuto por IP (ADR 0003). */
export const LOGIN_IP_LIMIT = 20;

/** Tentativas máximas por minuto por e-mail (ADR 0003). */
export const LOGIN_EMAIL_LIMIT = 10;

/** Janela do rate limiting do login em milissegundos (1 minuto). */
export const LOGIN_TTL_MS = 60_000;

/** Mensagem genérica de excesso de tentativas (não revela a dimensão estourada). */
export const LOGIN_THROTTLE_ERROR_MESSAGE =
  'Muitas tentativas. Tente novamente mais tarde.';

/**
 * Tracker da dimensão por e-mail (ADR 0003): usa o e-mail do body do login,
 * com fallback para o IP quando o body não trouxer e-mail (requisições
 * malformadas não escapam do limite por origem).
 *
 * @param req Request HTTP cru (Express) — tipado como `Record<string, any>`
 * porque é o tipo exigido pela assinatura `ThrottlerGetTrackerFunction`.
 * @returns Chave de rastreamento (e-mail em minúsculas ou IP/`unknown`).
 */
export const loginEmailTracker: ThrottlerGetTrackerFunction = (req) => {
  const body = req.body as { email?: string } | undefined;
  const email = body?.email?.trim().toLowerCase();
  return email || (req.ip as string | undefined) || 'unknown';
};

/**
 * Opções do rate limiting do login (ADR 0003): duas dimensões independentes.
 *
 * - `default` — 20 tentativas/min por IP (rastreador padrão do guard);
 * - `email` — 10 tentativas/min por e-mail (`loginEmailTracker`).
 *
 * O guard é aplicado apenas na rota `POST /auth/login` via `@ThrottleLogin()`.
 *
 * @returns Opções do `ThrottlerModule` (storage em memória no MVP; Redis em
 * multi-instância).
 */
export function buildLoginThrottleOptions(): ThrottlerModuleOptions {
  return {
    throttlers: [
      { name: 'default', limit: LOGIN_IP_LIMIT, ttl: LOGIN_TTL_MS },
      {
        name: 'email',
        limit: LOGIN_EMAIL_LIMIT,
        ttl: LOGIN_TTL_MS,
        getTracker: loginEmailTracker,
      },
    ],
  };
}
