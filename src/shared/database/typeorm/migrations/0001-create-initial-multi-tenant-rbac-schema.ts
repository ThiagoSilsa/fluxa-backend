import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Cria a extensão pgcrypto, o enum user_type e o schema inicial de RBAC
 * multi-tenant: company, user, role, permission (catálogo global, sem
 * company_id), role_permission e user_role.
 *
 * SQL cru e idempotente, com nomes explícitos de constraints/índices
 * (PK_/UQ_/IDX_/FK_) e down() simétrico — conforme ADR 0001 e AGENTS.md.
 * A extensão pgcrypto é mantida no down() porque é usada por migrations futuras.
 */
export class CreateInitialMultiTenantRbacSchema1760000000000 implements MigrationInterface {
  name = 'CreateInitialMultiTenantRbacSchema1760000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "pgcrypto"`);

    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_type') THEN
          CREATE TYPE "user_type" AS ENUM ('EMPLOYEE', 'VISITOR');
        END IF;
      END
      $$;
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "company" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "name" varchar(255) NOT NULL,
        "is_active" boolean NOT NULL DEFAULT true,
        "timezone" varchar(64) NOT NULL DEFAULT 'America/Sao_Paulo',
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_company_id" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "user" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "company_id" uuid NOT NULL,
        "name" varchar(255) NOT NULL,
        "email" varchar(255) NOT NULL,
        "password" varchar(255) NOT NULL,
        "phone" varchar(32) NULL,
        "document" varchar(32) NULL,
        "type" user_type NOT NULL DEFAULT 'VISITOR',
        "is_active" boolean NOT NULL DEFAULT true,
        "observation" text NULL,
        "photo_url" varchar(512) NULL,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_user_id" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_user_company_id_email" UNIQUE ("company_id", "email"),
        CONSTRAINT "UQ_user_company_id_document" UNIQUE ("company_id", "document"),
        CONSTRAINT "FK_user_company_id" FOREIGN KEY ("company_id") REFERENCES "company"("id")
      )
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_user_company_id" ON "user" ("company_id")`,
    );

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "role" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "company_id" uuid NOT NULL,
        "name" varchar(100) NOT NULL,
        "description" text NULL,
        "is_admin" boolean NOT NULL DEFAULT false,
        "is_active" boolean NOT NULL DEFAULT true,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_role_id" PRIMARY KEY ("id"),
        CONSTRAINT "FK_role_company_id" FOREIGN KEY ("company_id") REFERENCES "company"("id")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "permission" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "code" varchar(100) NOT NULL,
        "description" text NULL,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_permission_id" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_permission_code" UNIQUE ("code")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "role_permission" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "company_id" uuid NOT NULL,
        "role_id" uuid NOT NULL,
        "permission_id" uuid NOT NULL,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_role_permission_id" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_role_permission_company_role_permission" UNIQUE ("company_id", "role_id", "permission_id"),
        CONSTRAINT "FK_role_permission_company_id" FOREIGN KEY ("company_id") REFERENCES "company"("id"),
        CONSTRAINT "FK_role_permission_role_id" FOREIGN KEY ("role_id") REFERENCES "role"("id"),
        CONSTRAINT "FK_role_permission_permission_id" FOREIGN KEY ("permission_id") REFERENCES "permission"("id")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "user_role" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "company_id" uuid NOT NULL,
        "user_id" uuid NOT NULL,
        "role_id" uuid NOT NULL,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_user_role_id" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_user_role_company_user_role" UNIQUE ("company_id", "user_id", "role_id"),
        CONSTRAINT "FK_user_role_company_id" FOREIGN KEY ("company_id") REFERENCES "company"("id"),
        CONSTRAINT "FK_user_role_user_id" FOREIGN KEY ("user_id") REFERENCES "user"("id"),
        CONSTRAINT "FK_user_role_role_id" FOREIGN KEY ("role_id") REFERENCES "role"("id")
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "user_role" CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS "role_permission" CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS "permission" CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS "role" CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS "user" CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS "company" CASCADE`);
    await queryRunner.query(`DROP TYPE IF EXISTS "user_type"`);
    // pgcrypto é mantido de propósito (usado por migrations futuras).
  }
}
