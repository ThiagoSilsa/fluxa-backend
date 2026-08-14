import { PostgreSqlContainer } from '@testcontainers/postgresql';
import { execSync } from 'node:child_process';
import { resolve } from 'node:path';

/**
 * Sobe um PostgreSQL real via Testcontainers e valida que todas as migrations
 * (e seeds) aplicam do zero: roda `npm run build` + `npm run db:migration:run`
 * contra o banco temporário. Falha se qualquer etapa quebrar.
 *
 * @returns Promise que resolve quando as migrations aplicam com sucesso.
 */
async function main(): Promise<void> {
  console.log('[run-db-migration] Subindo Postgres via Testcontainers...');
  const container = await new PostgreSqlContainer('postgres:16-alpine').start();
  try {
    process.env.DB_HOST = container.getHost();
    process.env.DB_PORT = String(container.getMappedPort(5432));
    process.env.DB_USERNAME = container.getUsername();
    process.env.DB_PASSWORD = container.getPassword();
    process.env.DB_NAME = container.getDatabase();

    const root = resolve(__dirname, '..');
    console.log('[run-db-migration] Compilando o projeto (npm run build)...');
    execSync('npm run build', { cwd: root, stdio: 'inherit' });

    console.log('[run-db-migration] Aplicando migrations + seeds do zero...');
    execSync('npm run db:migration:run', {
      cwd: root,
      stdio: 'inherit',
      env: process.env,
    });

    console.log(
      '[run-db-migration] OK — migrations aplicadas do zero sem erro.',
    );
  } finally {
    await container.stop();
  }
}

main().catch((error: unknown) => {
  console.error('[run-db-migration] Falhou:', error);
  process.exit(1);
});
