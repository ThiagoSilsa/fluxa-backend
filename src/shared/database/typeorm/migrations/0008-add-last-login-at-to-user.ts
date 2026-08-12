import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Adiciona `user.last_login_at` (ADR 0003 — endurecimento do login):
 *
 * - coluna `timestamptz` nullable com o momento do último login da pessoa;
 * - atualizada de forma **não-bloqueante** no `LoginUseCase` (falha ao gravar
 *   não derruba a sessão);
 * - sem backfill (nullable) — registros antigos ficam NULL até o próximo login.
 *
 * SQL cru e idempotente, com `down()` simétrico — conforme ADR 0001/0003 e
 * AGENTS.md. A migration `0007` é reservada à auditoria (`audit_log`).
 */
export class AddLastLoginAtToUser1760000000007 implements MigrationInterface {
  name = 'AddLastLoginAtToUser1760000000007';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "last_login_at" timestamptz NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "user" DROP COLUMN IF EXISTS "last_login_at"`,
    );
  }
}
