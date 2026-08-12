import { Injectable } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import { LOGIN_THROTTLE_ERROR_MESSAGE } from './login-throttle.options';

/**
 * Guard de rate limiting do `POST /auth/login` (ADR 0003).
 *
 * Estende o `ThrottlerGuard` do `@nestjs/throttler`: as duas dimensões
 * (20/min por IP e 10/min por e-mail) e seus rastreadores vêm das opções do
 * `ThrottlerModule` (`buildLoginThrottleOptions`). Esta subclasse apenas
 * substitui a mensagem de excesso por uma **genérica** — não revela qual
 * dimensão estourou (evita vazar se foi o IP ou o e-mail).
 */
@Injectable()
export class LoginThrottleGuard extends ThrottlerGuard {
  /** Mensagem genérica de excesso de tentativas (ADR 0003). */
  protected override errorMessage = LOGIN_THROTTLE_ERROR_MESSAGE;
}
