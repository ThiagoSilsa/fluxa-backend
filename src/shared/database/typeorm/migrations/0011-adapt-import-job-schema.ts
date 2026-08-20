import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Evolui a tabela `import_job` para o modelo fail-fast (ADR 0007 §3):
 * adiciona `file_name`, `success_count`, `error_count`, `error_message`,
 * `started_at` e `completed_at`; remove a coluna `errors` (desenhada para
 * importação parcial, descartada em 20/08 — tabela vazia, sem perda); e
 * estende o ENUM `import_job_type` com `DEPARTMENT`.
 *
 * SQL cru e idempotente, com nomes explícitos e down() simétrico — conforme
 * ADR 0001 e AGENTS.md. `ALTER TYPE ... ADD VALUE` é permitido em transação no
 * PG16 (o valor não é usado nesta migration).
 */
export class AdaptImportJobSchema1760000000010 implements MigrationInterface {
  name = 'AdaptImportJobSchema1760000000010';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "import_job" ADD COLUMN IF NOT EXISTS "file_name" varchar(255) NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "import_job" ADD COLUMN IF NOT EXISTS "success_count" integer NOT NULL DEFAULT 0`,
    );
    await queryRunner.query(
      `ALTER TABLE "import_job" ADD COLUMN IF NOT EXISTS "error_count" integer NOT NULL DEFAULT 0`,
    );
    await queryRunner.query(
      `ALTER TABLE "import_job" ADD COLUMN IF NOT EXISTS "error_message" text NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "import_job" ADD COLUMN IF NOT EXISTS "started_at" timestamptz NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "import_job" ADD COLUMN IF NOT EXISTS "completed_at" timestamptz NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "import_job" DROP COLUMN IF EXISTS "errors"`,
    );
    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_enum
          WHERE enumlabel = 'DEPARTMENT' AND enumtypid = 'import_job_type'::regtype
        ) THEN
          ALTER TYPE "import_job_type" ADD VALUE 'DEPARTMENT';
        END IF;
      END
      $$;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // `ALTER TYPE ... ADD VALUE` não é reversível — o valor DEPARTMENT
    // permanece no enum após o revert (nota documentada no ADR 0007 §3).
    await queryRunner.query(
      `ALTER TABLE "import_job" DROP COLUMN IF EXISTS "completed_at"`,
    );
    await queryRunner.query(
      `ALTER TABLE "import_job" DROP COLUMN IF EXISTS "started_at"`,
    );
    await queryRunner.query(
      `ALTER TABLE "import_job" DROP COLUMN IF EXISTS "error_message"`,
    );
    await queryRunner.query(
      `ALTER TABLE "import_job" DROP COLUMN IF EXISTS "error_count"`,
    );
    await queryRunner.query(
      `ALTER TABLE "import_job" DROP COLUMN IF EXISTS "success_count"`,
    );
    await queryRunner.query(
      `ALTER TABLE "import_job" DROP COLUMN IF EXISTS "file_name"`,
    );
    await queryRunner.query(
      `ALTER TABLE "import_job" ADD COLUMN IF NOT EXISTS "errors" jsonb NOT NULL DEFAULT '[]'`,
    );
  }
}
