import { UseGuards, applyDecorators } from '@nestjs/common';
import { LoginThrottleGuard } from './login-throttle.guard';

/**
 * Aplica o rate limiting do login (ADR 0003) a um método de controller.
 *
 * Os limites (20/min por IP, 10/min por e-mail) e os rastreadores vêm das
 * opções do `ThrottlerModule` configuradas em `ThrottlerConfigModule` — o
 * decorator apenas anexa o `LoginThrottleGuard` à rota.
 *
 * @returns Decorator de método que registra o `LoginThrottleGuard`.
 */
export function ThrottleLogin(): MethodDecorator {
  return applyDecorators(UseGuards(LoginThrottleGuard));
}
