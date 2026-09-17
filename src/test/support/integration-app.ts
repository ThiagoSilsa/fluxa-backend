// NestJS
import type { INestApplication, Type } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import type { TestingModule } from '@nestjs/testing';

/**
 * Monta o app NestJS dos testes de integração importando o `AppModule` por
 * **import dinâmico**, ou seja, só depois que o env da suíte já foi definido.
 *
 * Por que não importar `AppModule` no topo do arquivo: `ConfigModule.forRoot`
 * (em `app.module.ts`) roda quando o módulo é avaliado e congela o resultado de
 * `validateEnvironment` dentro do `ConfigService` — e `ConfigService.get()`
 * prioriza esse valor congelado sobre `process.env`. Como os contexts sobem
 * Postgres/Redis em Testcontainers e só então escrevem `REDIS_HOST`/`REDIS_PORT`
 * em `process.env`, um import estático (avaliado antes de tudo) faria todos os
 * apps apontarem para o Redis do `docker-compose` (`localhost:6379`) — o mesmo
 * para todas as suítes. Com isso, os workers BullMQ de suítes diferentes
 * entravam na mesma fila e roubavam jobs uns dos outros (jobs processados por
 * dois apps distintos, "File not found" no arquivo temporário etc.).
 *
 * Importando aqui, cada suíte avalia `AppModule` com o próprio env já aplicado
 * e conversa apenas com o seu container.
 *
 * @returns App inicializado + o `TestingModule` (para `app.get`/`moduleFixture.get`).
 */
export async function createIntegrationApp(): Promise<{
  app: INestApplication;
  moduleFixture: TestingModule;
}> {
  // `require` (e não `import()` dinâmico) porque o jest roda os testes em CJS e
  // o `import()` nativo só funciona com `--experimental-vm-modules`.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { AppModule } = require('../../app.module') as {
    AppModule: Type<unknown>;
  };

  const moduleFixture: TestingModule = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();

  const app = moduleFixture.createNestApplication();
  await app.init();

  // Guarda de regressão: o env do container (escrito pelos contexts antes de
  // chamar este helper) precisa ter chegado ao `ConfigService`. Se alguém
  // voltar a importar `AppModule` no topo de um context, a suíte falha aqui
  // com uma mensagem clara em vez de vazar jobs BullMQ entre suítes.
  const config = app.get(ConfigService);
  const resolved = `${config.get<string>('REDIS_HOST')}:${config.get<number>('REDIS_PORT')}`;
  const expected = `${process.env.REDIS_HOST}:${process.env.REDIS_PORT}`;
  if (resolved !== expected) {
    throw new Error(
      `App não usou o Redis do container: esperado ${expected}, resolvido ${resolved}. ` +
        'Confirme que `AppModule` é carregado via `createIntegrationApp()` (import tardio).',
    );
  }

  return { app, moduleFixture };
}
