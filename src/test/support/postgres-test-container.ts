import {
  PostgreSqlContainer,
  StartedPostgreSqlContainer,
} from '@testcontainers/postgresql';

/**
 * Wrapper do Postgres via Testcontainers para testes de integração.
 *
 * Sobe um Postgres 16 real em container e injeta as variáveis de ambiente que
 * o TypeORM lê (`DB_HOST`, `DB_PORT`, `DB_USERNAME`, `DB_PASSWORD`, `DB_NAME`,
 * `DB_SYNCHRONIZE`, `DB_LOGGING`). O schema evolui por migrations (ADR 0001),
 * por isso `DB_SYNCHRONIZE` fica `false`.
 *
 * Uso típico:
 *
 * ```ts
 * const container = await new PostgresTestContainer().start();
 * // ... seta process.env (JWT_SECRET etc.) e compila o módulo ...
 * await container.stop();
 * ```
 */
export class PostgresTestContainer {
  private container: StartedPostgreSqlContainer | null = null;

  /**
   * Sobe o container (reutiliza a instância já iniciada).
   *
   * @returns O container Postgres iniciado, com as env `DB_*` já injetadas.
   */
  async start(): Promise<StartedPostgreSqlContainer> {
    if (this.container) {
      return this.container;
    }
    const image =
      process.env.TESTCONTAINERS_POSTGRES_IMAGE ?? 'postgres:16-alpine';
    this.container = await new PostgreSqlContainer(image)
      .withDatabase('fluxa_integration')
      .withUsername('postgres')
      .withPassword('postgres')
      .start();

    process.env.DB_HOST = this.container.getHost();
    process.env.DB_PORT = String(this.container.getPort());
    process.env.DB_USERNAME = this.container.getUsername();
    process.env.DB_PASSWORD = this.container.getPassword();
    process.env.DB_NAME = this.container.getDatabase();
    process.env.DB_SYNCHRONIZE = 'false';
    process.env.DB_LOGGING = 'false';

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
