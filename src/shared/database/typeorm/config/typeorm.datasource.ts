import 'dotenv/config';
import { DataSource } from 'typeorm';

/**
 * DataSource de CLI usado pelos scripts `db:migration:*`.
 *
 * Enxerga migrations **e** seeds (ambos implementados como MigrationInterface e
 * rastreados na mesma tabela `migrations`). `synchronize` é sempre `false`.
 */
export default new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST ?? 'localhost',
  port: parseInt(process.env.DB_PORT ?? '5432', 10),
  username: process.env.DB_USERNAME ?? 'postgres',
  password: process.env.DB_PASSWORD ?? 'postgres',
  database: process.env.DB_NAME ?? 'postgres',
  synchronize: false,
  logging: (process.env.DB_LOGGING ?? 'false') === 'true',
  entities: [],
  migrations: [
    `${__dirname}/../migrations/*{.ts,.js}`,
    `${__dirname}/../seeds/*{.ts,.js}`,
  ],
});
