import 'dotenv/config';
import { DataSource } from 'typeorm';

/**
 * DataSource de CLI usado pelos scripts `db:seed:*`.
 *
 * Enxerga **apenas** seeds, permitindo aplicá-los/revertê-los independentemente
 * das migrations (ex.: em pipelines de CI/CD ou para reexecutar dados base).
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
  migrations: [`${__dirname}/../seeds/*{.ts,.js}`],
});
