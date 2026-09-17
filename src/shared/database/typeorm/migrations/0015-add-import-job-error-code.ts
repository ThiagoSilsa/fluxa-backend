import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Guarda o **código** e os **parâmetros** do erro de importação no job
 * (ADR 0016 §6): o cliente traduz pelo código, com os parâmetros que a frase
 * precisa, em vez de exibir o texto em português que o worker gravar.
 *
 * `error_message` continua existindo como texto de desenvolvimento e log.
 * SQL cru e idempotente, com down() simétrico — conforme ADR 0001 e AGENTS.md.
 */
export class AddImportJobErrorCode1760000000015 implements MigrationInterface {
  name = 'AddImportJobErrorCode1760000000015';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "import_job" ADD COLUMN IF NOT EXISTS "error_code" varchar(100) NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "import_job" ADD COLUMN IF NOT EXISTS "error_params" jsonb NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "import_job" DROP COLUMN IF EXISTS "error_params"`,
    );
    await queryRunner.query(
      `ALTER TABLE "import_job" DROP COLUMN IF EXISTS "error_code"`,
    );
  }
}
