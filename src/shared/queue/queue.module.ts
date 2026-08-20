// NestJS
import { DynamicModule, Global, Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { ConfigModule, ConfigService } from '@nestjs/config';

/**
 * Nomes das filas de importação — uma por tipo (ADR 0007 §2).
 */
export const QUEUE_NAMES = {
  IMPORT_DEPARTMENTS: 'import-departments',
  IMPORT_VEHICLES: 'import-vehicles',
  IMPORT_USERS: 'import-users',
  IMPORT_USER_VEHICLES: 'import-user-vehicles',
} as const;

/** Nome de uma fila de importação (usado em `@InjectQueue` e `@Processor`). */
export type ImportQueueName = (typeof QUEUE_NAMES)[keyof typeof QUEUE_NAMES];

/** Opções padrão dos jobs de importação (retry + retenção limitada). */
const IMPORT_JOB_OPTIONS = {
  attempts: 2,
  backoff: { type: 'exponential' as const, delay: 5000 },
  removeOnComplete: 50,
  removeOnFail: 100,
};

/**
 * Registra a fila de importação de um tipo no módulo que a consome (padrão
 * idiomático do @nestjs/bullmq: quem injeta via `@InjectQueue` ou declara um
 * `@Processor` importa a própria fila).
 *
 * @param name Nome da fila (ver `QUEUE_NAMES`).
 * @returns Módulo dinâmico do BullModule com a fila registrada.
 */
export function registerImportQueue(name: ImportQueueName): DynamicModule {
  return BullModule.registerQueue({
    name,
    defaultJobOptions: IMPORT_JOB_OPTIONS,
  });
}

/**
 * Módulo global de filas (BullMQ) — ADR 0007 §2.
 *
 * Configura a conexão Redis (`REDIS_HOST`/`REDIS_PORT`) de forma global
 * (`@Global()`), para que qualquer `registerImportQueue`/`BullModule` no app
 * use a mesma conexão. As filas em si são registradas nos módulos que as
 * consomem (use case com `@InjectQueue` + processor com `@Processor`) via
 * `registerImportQueue`.
 */
@Global()
@Module({
  imports: [
    BullModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        connection: {
          host: config.get<string>('REDIS_HOST', 'localhost'),
          port: config.get<number>('REDIS_PORT', 6379),
        },
        defaultJobOptions: { removeOnComplete: 100, removeOnFail: 500 },
      }),
    }),
  ],
})
export class QueueModule {}
