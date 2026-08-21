import { GenericContainer, StartedTestContainer } from 'testcontainers';

/**
 * Wrapper do Redis via Testcontainers para testes de integração.
 *
 * Sobe um Redis 7 real em container e injeta as variáveis de ambiente que o
 * BullMQ lê (`REDIS_HOST`, `REDIS_PORT`). Necessário para os testes que
 * dependem de fila de verdade (workers de importação — ADR 0007 §10).
 *
 * Uso típico:
 *
 * ```ts
 * const redis = await new RedisTestContainer().start();
 * // ... monta o app (o QueueModule conecta no host/porta do container) ...
 * await redis.stop();
 * ```
 */
export class RedisTestContainer {
  private container: StartedTestContainer | null = null;

  /**
   * Sobe o container (reutiliza a instância já iniciada).
   *
   * @returns O container Redis iniciado, com as env `REDIS_*` já injetadas.
   */
  async start(): Promise<StartedTestContainer> {
    if (this.container) {
      return this.container;
    }
    const image = process.env.TESTCONTAINERS_REDIS_IMAGE ?? 'redis:7-alpine';
    this.container = await new GenericContainer(image)
      .withExposedPorts(6379)
      .start();

    process.env.REDIS_HOST = this.container.getHost();
    process.env.REDIS_PORT = String(this.container.getMappedPort(6379));

    return this.container;
  }

  /**
   * Derruba o container, se estiver de pé.
   */
  async stop(): Promise<void> {
    if (!this.container) {
      return;
    }
    await this.container.stop();
    this.container = null;
  }
}
