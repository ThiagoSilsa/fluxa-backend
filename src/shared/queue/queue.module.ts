// NestJS
import { Global, Module } from '@nestjs/common';
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

/** Filas de importação registradas pelo módulo. */
const IMPORT_QUEUES: ImportQueueName[] = [
  QUEUE_NAMES.IMPORT_DEPARTMENTS,
  QUEUE_NAMES.IMPORT_VEHICLES,
  QUEUE_NAMES.IMPORT_USERS,
  QUEUE_NAMES.IMPORT_USER_VEHICLES,
];

/**
 * Módulo global de filas (BullMQ) — ADR 0007 §2.
 *
 * Configura a conexão Redis (`REDIS_HOST`/`REDIS_PORT`) e registra uma fila
 * por tipo de importação com `attempts: 2`, backoff exponencial (5000ms) e
 * retenção limitada (50 completos / 100 falhos). A `concurrency: 1` é aplicada
 * nos processors de cada fila (evita corrida entre importações do mesmo tipo).
 *
 * Por ser `@Global()`, `@InjectQueue(QUEUE_NAMES.X)` funciona em qualquer
 * módulo sem import extra (necessidade real — AGENTS.md §2).
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
    BullModule.registerQueue(
      ...IMPORT_QUEUES.map((name) => ({
        name,
        defaultJobOptions: {
          attempts: 2,
          backoff: { type: 'exponential', delay: 5000 },
          removeOnComplete: 50,
          removeOnFail: 100,
        },
      })),
    ),
  ],
})
export class QueueModule {}
