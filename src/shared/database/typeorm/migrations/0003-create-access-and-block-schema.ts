import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Cria o schema de bloqueios e portarias: enums (vehicle_block_type,
 * vehicle_block_status, entry_denial_reason, sync_status, block_request_status),
 * entrance, vehicle_block, entry_denial e block_request — com uniques compostos
 * por empresa, uniques parciais de bloqueio ativo e colunas de idempotência.
 *
 * SQL cru e idempotente, com nomes explícitos de constraints/índices
 * (PK_/UQ_/IDX_/FK_) e down() simétrico — conforme ADR 0001 e AGENTS.md.
 */
export class CreateAccessAndBlockSchema1760000000002 implements MigrationInterface {
  name = 'CreateAccessAndBlockSchema1760000000002';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'vehicle_block_type') THEN
          CREATE TYPE "vehicle_block_type" AS ENUM ('MANUAL', 'AUTOMATIC');
        END IF;
      END
      $$;
    `);
    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'vehicle_block_status') THEN
          CREATE TYPE "vehicle_block_status" AS ENUM ('ACTIVE', 'REVOKED');
        END IF;
      END
      $$;
    `);
    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'entry_denial_reason') THEN
          CREATE TYPE "entry_denial_reason" AS ENUM ('BLOCKED', 'UNREGISTERED', 'UNAUTHORIZED_DRIVER', 'OTHER');
        END IF;
      END
      $$;
    `);
    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'sync_status') THEN
          CREATE TYPE "sync_status" AS ENUM ('PENDING', 'SYNCED');
        END IF;
      END
      $$;
    `);
    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'block_request_status') THEN
          CREATE TYPE "block_request_status" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'CANCELLED');
        END IF;
      END
      $$;
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "entrance" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "company_id" uuid NOT NULL,
        "name" varchar(100) NOT NULL,
        "is_active" boolean NOT NULL DEFAULT true,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_entrance_id" PRIMARY KEY ("id"),
        CONSTRAINT "FK_entrance_company_id" FOREIGN KEY ("company_id") REFERENCES "company"("id")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "vehicle_block" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "company_id" uuid NOT NULL,
        "vehicle_id" uuid NULL,
        "plate" varchar(10) NOT NULL,
        "block_type" vehicle_block_type NOT NULL DEFAULT 'MANUAL',
        "reason" text NOT NULL,
        "status" vehicle_block_status NOT NULL DEFAULT 'ACTIVE',
        "blocked_by" uuid NULL,
        "blocked_at" timestamptz NOT NULL DEFAULT now(),
        "revoked_by" uuid NULL,
        "revoked_at" timestamptz NULL,
        "revoked_reason" text NULL,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_vehicle_block_id" PRIMARY KEY ("id"),
        CONSTRAINT "FK_vehicle_block_company_id" FOREIGN KEY ("company_id") REFERENCES "company"("id"),
        CONSTRAINT "FK_vehicle_block_vehicle_id" FOREIGN KEY ("vehicle_id") REFERENCES "vehicle"("id"),
        CONSTRAINT "FK_vehicle_block_blocked_by" FOREIGN KEY ("blocked_by") REFERENCES "user"("id"),
        CONSTRAINT "FK_vehicle_block_revoked_by" FOREIGN KEY ("revoked_by") REFERENCES "user"("id")
      )
    `);
    await queryRunner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS "UQ_vehicle_block_company_vehicle_active"
       ON "vehicle_block" ("company_id", "vehicle_id")
       WHERE "status" = 'ACTIVE' AND "vehicle_id" IS NOT NULL`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS "UQ_vehicle_block_company_plate_active_unreg"
       ON "vehicle_block" ("company_id", "plate")
       WHERE "status" = 'ACTIVE' AND "vehicle_id" IS NULL`,
    );

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "entry_denial" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "company_id" uuid NOT NULL,
        "vehicle_id" uuid NULL,
        "plate_snapshot" varchar(10) NOT NULL,
        "block_id" uuid NULL,
        "reason" entry_denial_reason NOT NULL,
        "observation" text NULL,
        "entrance_id" uuid NULL,
        "doorman_id" uuid NOT NULL,
        "occurred_at" timestamptz NOT NULL DEFAULT now(),
        "sync_status" sync_status NOT NULL DEFAULT 'PENDING',
        "idempotency_key" uuid NOT NULL,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_entry_denial_id" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_entry_denial_company_idempotency_key" UNIQUE ("company_id", "idempotency_key"),
        CONSTRAINT "FK_entry_denial_company_id" FOREIGN KEY ("company_id") REFERENCES "company"("id"),
        CONSTRAINT "FK_entry_denial_vehicle_id" FOREIGN KEY ("vehicle_id") REFERENCES "vehicle"("id"),
        CONSTRAINT "FK_entry_denial_block_id" FOREIGN KEY ("block_id") REFERENCES "vehicle_block"("id"),
        CONSTRAINT "FK_entry_denial_entrance_id" FOREIGN KEY ("entrance_id") REFERENCES "entrance"("id"),
        CONSTRAINT "FK_entry_denial_doorman_id" FOREIGN KEY ("doorman_id") REFERENCES "user"("id")
      )
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_entry_denial_company_occurred_at" ON "entry_denial" ("company_id", "occurred_at")`,
    );

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "block_request" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "company_id" uuid NOT NULL,
        "vehicle_id" uuid NULL,
        "plate" varchar(10) NOT NULL,
        "reason" text NOT NULL,
        "status" block_request_status NOT NULL DEFAULT 'PENDING',
        "requested_by" uuid NOT NULL,
        "requested_at" timestamptz NOT NULL DEFAULT now(),
        "handled_by" uuid NULL,
        "handled_at" timestamptz NULL,
        "observation" text NULL,
        "status_history" jsonb NOT NULL DEFAULT '[]',
        "resolved_block_id" uuid NULL,
        "sync_status" sync_status NOT NULL DEFAULT 'PENDING',
        "idempotency_key" uuid NOT NULL,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_block_request_id" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_block_request_company_idempotency_key" UNIQUE ("company_id", "idempotency_key"),
        CONSTRAINT "FK_block_request_company_id" FOREIGN KEY ("company_id") REFERENCES "company"("id"),
        CONSTRAINT "FK_block_request_vehicle_id" FOREIGN KEY ("vehicle_id") REFERENCES "vehicle"("id"),
        CONSTRAINT "FK_block_request_requested_by" FOREIGN KEY ("requested_by") REFERENCES "user"("id"),
        CONSTRAINT "FK_block_request_handled_by" FOREIGN KEY ("handled_by") REFERENCES "user"("id"),
        CONSTRAINT "FK_block_request_resolved_block_id" FOREIGN KEY ("resolved_block_id") REFERENCES "vehicle_block"("id")
      )
    `);
    await queryRunner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS "UQ_block_request_company_plate_pending"
       ON "block_request" ("company_id", "plate")
       WHERE "status" = 'PENDING'`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_block_request_company_status" ON "block_request" ("company_id", "status")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "block_request" CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS "entry_denial" CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS "vehicle_block" CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS "entrance" CASCADE`);
    await queryRunner.query(`DROP TYPE IF EXISTS "block_request_status"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "sync_status"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "entry_denial_reason"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "vehicle_block_status"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "vehicle_block_type"`);
  }
}
