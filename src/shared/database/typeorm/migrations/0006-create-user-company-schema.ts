import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Aplica o modelo multi-empresa do ADR 0002 ("a pessoa é a identidade; a
 * empresa é um vínculo"):
 *
 * - cria a tabela `user_company` (vínculo pessoa ↔ empresa) com type/is_active
 *   (o que muda por empresa mora no vínculo);
 * - faz backfill criando um vínculo por linha atual de `user`;
 * - remove `company_id`, `type` e `is_active` de `user`;
 * - torna `email` e `document` únicos globalmente (a pessoa é única no sistema).
 *
 * SQL cru e idempotente, com nomes explícitos de constraints/índices
 * (PK_/UQ_/IDX_/FK_) e down() simétrico — conforme ADR 0001, ADR 0002 e
 * AGENTS.md.
 */
export class CreateUserCompanySchema1760000000005 implements MigrationInterface {
  name = 'CreateUserCompanySchema1760000000005';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "user_company" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "user_id" uuid NOT NULL,
        "company_id" uuid NOT NULL,
        "type" user_type NOT NULL DEFAULT 'VISITOR',
        "is_active" boolean NOT NULL DEFAULT true,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_user_company_id" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_user_company_user_company" UNIQUE ("user_id", "company_id"),
        CONSTRAINT "FK_user_company_user_id" FOREIGN KEY ("user_id") REFERENCES "user"("id"),
        CONSTRAINT "FK_user_company_company_id" FOREIGN KEY ("company_id") REFERENCES "company"("id")
      )
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_user_company_user_id" ON "user_company" ("user_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_user_company_company_id" ON "user_company" ("company_id")`,
    );

    // Backfill: 1 vínculo por linha atual de user (a pessoa vira o vínculo).
    await queryRunner.query(`
      INSERT INTO "user_company" ("id", "user_id", "company_id", "type", "is_active", "created_at", "updated_at")
      SELECT gen_random_uuid(), "id", "company_id", "type", "is_active", now(), now()
      FROM "user"
      ON CONFLICT ("user_id", "company_id") DO NOTHING
    `);

    // Remove de user o que passou a ser do vínculo (ADR 0002).
    await queryRunner.query(
      `ALTER TABLE "user" DROP CONSTRAINT IF EXISTS "FK_user_company_id"`,
    );
    await queryRunner.query(
      `ALTER TABLE "user" DROP CONSTRAINT IF EXISTS "UQ_user_company_id_email"`,
    );
    await queryRunner.query(
      `ALTER TABLE "user" DROP CONSTRAINT IF EXISTS "UQ_user_company_id_document"`,
    );
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_user_company_id"`);
    await queryRunner.query(
      `ALTER TABLE "user" DROP COLUMN IF EXISTS "company_id"`,
    );
    await queryRunner.query(`ALTER TABLE "user" DROP COLUMN IF EXISTS "type"`);
    await queryRunner.query(
      `ALTER TABLE "user" DROP COLUMN IF EXISTS "is_active"`,
    );

    // Unicidade global da identidade (NULLs permitidos em document).
    await queryRunner.query(
      `ALTER TABLE "user" ADD CONSTRAINT "UQ_user_email" UNIQUE ("email")`,
    );
    await queryRunner.query(
      `ALTER TABLE "user" ADD CONSTRAINT "UQ_user_document" UNIQUE ("document")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Remove as uniques globais antes de restaurar as compostas por empresa.
    await queryRunner.query(
      `ALTER TABLE "user" DROP CONSTRAINT IF EXISTS "UQ_user_email"`,
    );
    await queryRunner.query(
      `ALTER TABLE "user" DROP CONSTRAINT IF EXISTS "UQ_user_document"`,
    );

    // Restaura as colunas movidas para o vínculo.
    await queryRunner.query(`ALTER TABLE "user" ADD COLUMN "company_id" uuid`);
    await queryRunner.query(
      `ALTER TABLE "user" ADD COLUMN "type" user_type NOT NULL DEFAULT 'VISITOR'`,
    );
    await queryRunner.query(
      `ALTER TABLE "user" ADD COLUMN "is_active" boolean NOT NULL DEFAULT true`,
    );

    // Backfill reverso: devolve a user o 1º vínculo de cada pessoa
    // (ordem por created_at — limitação documentada p/ pessoa com N vínculos).
    await queryRunner.query(`
      UPDATE "user" AS u
      SET "company_id" = uc."company_id",
          "type" = uc."type",
          "is_active" = uc."is_active"
      FROM (
        SELECT DISTINCT ON ("user_id") "user_id", "company_id", "type", "is_active"
        FROM "user_company"
        ORDER BY "user_id", "created_at"
      ) AS uc
      WHERE u."id" = uc."user_id"
    `);
    await queryRunner.query(
      `ALTER TABLE "user" ALTER COLUMN "company_id" SET NOT NULL`,
    );

    // Restaura as constraints compostas por empresa.
    await queryRunner.query(
      `ALTER TABLE "user" ADD CONSTRAINT "UQ_user_company_id_email" UNIQUE ("company_id", "email")`,
    );
    await queryRunner.query(
      `ALTER TABLE "user" ADD CONSTRAINT "UQ_user_company_id_document" UNIQUE ("company_id", "document")`,
    );
    await queryRunner.query(
      `ALTER TABLE "user" ADD CONSTRAINT "FK_user_company_id" FOREIGN KEY ("company_id") REFERENCES "company"("id")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_user_company_id" ON "user" ("company_id")`,
    );

    await queryRunner.query(`DROP TABLE IF EXISTS "user_company" CASCADE`);
  }
}
