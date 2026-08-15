import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Impede mais de um cargo por pessoa/empresa (ADR 0005 §5 — emenda):
 *
 * - **dedup** de linhas multi-cargo em `user_role`: mantém um cargo por
 *   `(company_id, user_id)`, priorizando `is_admin` (senão a mais antiga por
 *   `created_at`) e removendo as demais;
 * - troca o unique `UQ_user_role_company_user_role (company_id, user_id,
 *   role_id)` por `UQ_user_role_company_user UNIQUE (company_id, user_id)`.
 *
 * SQL cru e idempotente, com `down()` simétrico — conforme AGENTS.md e o
 * padrão das migrations anteriores.
 */
export class UniqueUserRolePerUserCompany1760000000008 implements MigrationInterface {
  name = 'UniqueUserRolePerUserCompany1760000000008';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Dedup: uma linha por (company_id, user_id), priorizando is_admin e a
    // mais antiga (created_at ASC) — apaga o restante antes de criar o unique.
    await queryRunner.query(`
      WITH ranked AS (
        SELECT ur."id",
               ROW_NUMBER() OVER (
                 PARTITION BY ur."company_id", ur."user_id"
                 ORDER BY r."is_admin" DESC, ur."created_at" ASC
               ) AS rn
        FROM "user_role" ur
        JOIN "role" r ON r."id" = ur."role_id"
      )
      DELETE FROM "user_role"
      WHERE "id" IN (SELECT "id" FROM ranked WHERE rn > 1)
    `);

    await queryRunner.query(
      `ALTER TABLE "user_role" DROP CONSTRAINT IF EXISTS "UQ_user_role_company_user_role"`,
    );
    await queryRunner.query(
      `ALTER TABLE "user_role" ADD CONSTRAINT "UQ_user_role_company_user" UNIQUE ("company_id", "user_id")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "user_role" DROP CONSTRAINT IF EXISTS "UQ_user_role_company_user"`,
    );
    await queryRunner.query(
      `ALTER TABLE "user_role" ADD CONSTRAINT "UQ_user_role_company_user_role" UNIQUE ("company_id", "user_id", "role_id")`,
    );
  }
}
