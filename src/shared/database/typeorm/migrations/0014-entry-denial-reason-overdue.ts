import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Acrescenta o motivo `OVERDUE` ao enum `entry_denial_reason` (ADR 0014 §4):
 * quando a solicitação da placa está vencida (regras 38/39) a portaria nega a
 * entrada e registra o impedimento com motivo próprio — separado de
 * `UNREGISTERED`/`BLOCKED` para permitir relatório e auditoria.
 *
 * `ADD VALUE IF NOT EXISTS` é idempotente e aceito dentro da transação da
 * migração (PostgreSQL 12+); o valor **não** é usado nesta mesma migração.
 */
export class AddEntryDenialReasonOverdue1760000000013 implements MigrationInterface {
  name = 'AddEntryDenialReasonOverdue1760000000013';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TYPE "entry_denial_reason" ADD VALUE IF NOT EXISTS 'OVERDUE'`,
    );
  }

  public async down(): Promise<void> {
    // PostgreSQL não remove valores de enum: recriar o tipo exigiria criar um
    // novo, converter a coluna `entry_denial.reason` e remover o antigo —
    // operação destrutiva e desproporcional para um rollback. Sem rollback,
    // como nas demais migrações de enum do projeto.
  }
}
