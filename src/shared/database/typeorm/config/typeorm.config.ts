import { TypeOrmModuleOptions } from '@nestjs/typeorm';

/**
 * Constrói as opções do TypeORM usadas pelo TypeOrmModule (runtime da aplicação).
 *
 * Usa variáveis de ambiente com defaults de desenvolvimento. `synchronize` deve
 * permanecer `false` em produção — o schema evolui exclusivamente por migrations.
 *
 * @returns As opções do TypeOrmModule para conexão com o PostgreSQL.
 */
export function buildTypeOrmOptions(): TypeOrmModuleOptions {
  return {
    type: 'postgres',
    host: process.env.DB_HOST ?? 'localhost',
    port: parseInt(process.env.DB_PORT ?? '5432', 10),
    username: process.env.DB_USERNAME ?? 'postgres',
    password: process.env.DB_PASSWORD ?? 'postgres',
    database: process.env.DB_NAME ?? 'postgres',
    synchronize: (process.env.DB_SYNCHRONIZE ?? 'false') === 'true',
    logging: (process.env.DB_LOGGING ?? 'false') === 'true',
    autoLoadEntities: true,
  };
}
