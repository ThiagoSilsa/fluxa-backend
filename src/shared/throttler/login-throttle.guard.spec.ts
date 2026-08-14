import { ExecutionContext } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { ThrottlerException, ThrottlerModule } from '@nestjs/throttler';
import {
  LOGIN_EMAIL_LIMIT,
  LOGIN_IP_LIMIT,
  LOGIN_THROTTLE_ERROR_MESSAGE,
  buildLoginThrottleOptions,
} from './login-throttle.options';
import { LoginThrottleGuard } from './login-throttle.guard';

/**
 * Testes unitários do `LoginThrottleGuard` (ADR 0003).
 *
 * Não bate no banco (AGENTS.md): apenas o guard + storage em memória do
 * `@nestjs/throttler`, com um `ExecutionContext` mockado.
 */
describe('LoginThrottleGuard (ADR 0003)', () => {
  /** Módulos de teste abertos (fechados no `afterEach` para o jest sair). */
  const openModules: TestingModule[] = [];

  afterEach(async () => {
    while (openModules.length > 0) {
      const moduleRef = openModules.pop();
      if (moduleRef) {
        await moduleRef.close();
      }
    }
  });

  /**
   * Monta um `ExecutionContext` mockado com IP e (opcional) e-mail no body.
   *
   * @param ip IP da requisição.
   * @param email E-mail do body do login (opcional).
   * @returns Contexto de execução simulado.
   */
  function buildContext(ip: string, email?: string): ExecutionContext {
    return {
      getHandler: () => () => undefined,
      getClass: () => class MockController {},
      switchToHttp: () => ({
        getRequest: () => ({ ip, body: email ? { email } : {} }),
        getResponse: () => ({ header: jest.fn() }),
      }),
    } as unknown as ExecutionContext;
  }

  /**
   * Compila um módulo de teste com o guard e o throttler configurado com as
   * opções reais do login.
   *
   * @returns Instância do `LoginThrottleGuard` pronta para uso.
   */
  async function buildGuard(): Promise<LoginThrottleGuard> {
    const moduleRef = await Test.createTestingModule({
      imports: [ThrottlerModule.forRoot(buildLoginThrottleOptions())],
      providers: [LoginThrottleGuard],
    }).compile();
    openModules.push(moduleRef);
    await moduleRef.init();
    return moduleRef.get(LoginThrottleGuard);
  }

  it('bloqueia com 429 genérico após LOGIN_IP_LIMIT tentativas do mesmo IP', async () => {
    const guard = await buildGuard();

    for (let i = 0; i < LOGIN_IP_LIMIT; i++) {
      await expect(
        guard.canActivate(buildContext('1.1.1.1', `user${i}@somar.local`)),
      ).resolves.toBe(true);
    }

    // E-mails distintos: só a dimensão por IP acumula.
    await expect(
      guard.canActivate(buildContext('1.1.1.1', 'outro@somar.local')),
    ).rejects.toBeInstanceOf(ThrottlerException);

    // A mensagem é genérica — não revela qual dimensão estourou.
    await expect(
      guard.canActivate(buildContext('1.1.1.1', 'outro2@somar.local')),
    ).rejects.toThrow(LOGIN_THROTTLE_ERROR_MESSAGE);
  });

  it('bloqueia após LOGIN_EMAIL_LIMIT tentativas do mesmo e-mail (IPs distintos)', async () => {
    const guard = await buildGuard();

    for (let i = 0; i < LOGIN_EMAIL_LIMIT; i++) {
      await expect(
        guard.canActivate(buildContext(`10.0.0.${i}`, 'alvo@somar.local')),
      ).resolves.toBe(true);
    }

    // IPs distintos: só a dimensão por e-mail acumula.
    await expect(
      guard.canActivate(buildContext('10.0.0.99', 'alvo@somar.local')),
    ).rejects.toBeInstanceOf(ThrottlerException);
  });

  it('não bloqueia e-mails e IPs distintos (nenhuma dimensão estoura)', async () => {
    const guard = await buildGuard();

    for (let i = 0; i < LOGIN_IP_LIMIT; i++) {
      await expect(
        guard.canActivate(
          buildContext(`10.1.0.${i}`, `distinto${i}@somar.local`),
        ),
      ).resolves.toBe(true);
    }
  });

  it('sem e-mail no body, as duas dimensões caem no IP (fallback)', async () => {
    const guard = await buildGuard();

    // Body sem e-mail: a dimensão por e-mail cai no fallback (IP) e passa a
    // contar junto com a por IP — a mais restritiva (e-mail, 10/min) bloqueia
    // primeiro. Requisições malformadas são limitadas ainda mais cedo.
    for (let i = 0; i < LOGIN_EMAIL_LIMIT; i++) {
      await expect(guard.canActivate(buildContext('10.2.0.1'))).resolves.toBe(
        true,
      );
    }

    await expect(
      guard.canActivate(buildContext('10.2.0.1')),
    ).rejects.toBeInstanceOf(ThrottlerException);
  });
});
