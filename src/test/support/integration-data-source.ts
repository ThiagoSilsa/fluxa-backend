import { DataSource } from 'typeorm';

/**
 * DataSource dos testes de integração — **as mesmas migrations e seeds da
 * aplicação**.
 *
 * A lista daqui é um glob (como no `typeorm.datasource.ts` da CLI), e não uma
 * lista de classes copiada em cada contexto: era essa cópia que deixava 10 dos
 * 14 contextos com um `import_job` sem `started_at`/`completed_at`, porque a
 * migration do adapt precisava ser lembrada à mão em cada arquivo.
 *
 * `synchronize` é sempre `false`: o schema dos testes evolui como o de
 * produção, por migration (ADR 0001).
 *
 * @returns DataSource pronto para `initialize()` + `runMigrations()`.
 */
export function createIntegrationDataSource(): DataSource {
  return new DataSource({
    type: 'postgres',
    host: process.env.DB_HOST ?? 'localhost',
    port: parseInt(process.env.DB_PORT ?? '5432', 10),
    username: process.env.DB_USERNAME ?? 'postgres',
    password: process.env.DB_PASSWORD ?? 'postgres',
    database: process.env.DB_NAME ?? 'postgres',
    synchronize: false,
    migrations: [
      `${__dirname}/../../shared/database/typeorm/migrations/*{.ts,.js}`,
      `${__dirname}/../../shared/database/typeorm/seeds/*{.ts,.js}`,
    ],
  });
}
