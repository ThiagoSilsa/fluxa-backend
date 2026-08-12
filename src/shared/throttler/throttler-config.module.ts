import { Module } from '@nestjs/common';
import { ThrottlerModule } from '@nestjs/throttler';
import { buildLoginThrottleOptions } from './login-throttle.options';

/**
 * Módulo global de rate limiting (ADR 0003).
 *
 * Configura o `ThrottlerModule` (que é `@Global()`) com as duas dimensões do
 * login. O guard (`LoginThrottleGuard`) é aplicado **apenas** na rota
 * `POST /auth/login` via `@ThrottleLogin()` — as demais rotas não são
 * limitadas por este módulo.
 *
 * Storage em memória no MVP; trocar por storage Redis quando a API rodar em
 * múltiplas instâncias (senão cada instância conta a sua própria janela).
 */
@Module({
  imports: [ThrottlerModule.forRoot(buildLoginThrottleOptions())],
})
export class ThrottlerConfigModule {}
