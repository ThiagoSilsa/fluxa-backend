import type { TestingModule } from '@nestjs/testing';
import { ThrottlerStorage, ThrottlerStorageService } from '@nestjs/throttler';

/**
 * Zera os contadores do rate limiting entre testes.
 *
 * O login tem teto de 10 tentativas/min por e-mail e 20/min por IP (ADR 0003)
 * — dimensionados para gente digitando; um arquivo de teste entra dezenas de
 * vezes com a mesma conta em segundos e estouraria o limite sem que nada
 * estivesse errado.
 *
 * @param moduleFixture Módulo de teste compilado (com o `ThrottlerModule`).
 */
export function resetThrottle(moduleFixture: TestingModule): void {
  moduleFixture.get<ThrottlerStorageService>(ThrottlerStorage).storage.clear();
}
