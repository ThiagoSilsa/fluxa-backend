import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Cria o schema de solicitações, device e importação: enums
 * (access_request_type, access_request_status, contact_channel,
 * device_platform, import_job_type, import_job_status), access_request,
 * device e import_job — e adiciona a FK adiada de
 * vehicle_access.access_request_id → access_request (coluna criada na 0004
 * sem constraint).
 *
 * SQL cru e idempotente, com nomes explícitos de constraints/índices
 * (PK_/UQ_/IDX_/FK_) e down() simétrico — conforme ADR 0001 e AGENTS.md.
 */
export class CreateRequestDeviceImportSchema1760000000004 implements MigrationInterface {
  name = 'CreateRequestDeviceImportSchema1760000000004';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'access_request_type') THEN
          CREATE TYPE "access_request_type" AS ENUM ('NEW_USER', 'NEW_VEHICLE', 'LINK', 'BOTH');
        END IF;
      END
      $$;
    `);
    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'access_request_status') THEN
          CREATE TYPE "access_request_status" AS ENUM ('PENDING', 'IN_CONTACT', 'REGISTERED', 'REJECTED', 'CANCELLED');
        END IF;
      END
      $$;
    `);
    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'contact_channel') THEN
          CREATE TYPE "contact_channel" AS ENUM ('WHATSAPP', 'PHONE', 'EMAIL');
        END IF;
      END
      $$;
    `);
    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'device_platform') THEN
          CREATE TYPE "device_platform" AS ENUM ('ANDROID', 'IOS');
        END IF;
      END
      $$;
    `);
    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'import_job_type') THEN
          CREATE TYPE "import_job_type" AS ENUM ('VEHICLE', 'USER', 'USER_VEHICLE');
        END IF;
      END
      $$;
    `);
    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'import_job_status') THEN
          CREATE TYPE "import_job_status" AS ENUM ('PENDING', 'PROCESSING', 'DONE', 'FAILED', 'PARTIAL');
        END IF;
      END
      $$;
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "access_request" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "company_id" uuid NOT NULL,
        "idempotency_key" uuid NOT NULL,
        "type" access_request_type NOT NULL,
        "plate" varchar(10) NOT NULL,
        "vehicle_id" uuid NULL,
        "user_id" uuid NULL,
        "status" access_request_status NOT NULL DEFAULT 'PENDING',
        "entry_authorized" boolean NOT NULL DEFAULT false,
        "authorized_by" uuid NULL,
        "authorized_at" timestamptz NULL,
        "requested_by" uuid NOT NULL,
        "requested_at" timestamptz NOT NULL DEFAULT now(),
        "handled_by" uuid NULL,
        "handled_at" timestamptz NULL,
        "contact_channel" contact_channel NULL,
        "contact_phone" varchar(32) NULL,
        "department_id" uuid NULL,
        "payload" jsonb NOT NULL DEFAULT '{}',
        "status_history" jsonb NOT NULL DEFAULT '[]',
        "resolved_user_id" uuid NULL,
        "resolved_vehicle_id" uuid NULL,
        "observation" text NULL,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_access_request_id" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_access_request_company_idempotency_key" UNIQUE ("company_id", "idempotency_key"),
        CONSTRAINT "FK_access_request_company_id" FOREIGN KEY ("company_id") REFERENCES "company"("id"),
        CONSTRAINT "FK_access_request_vehicle_id" FOREIGN KEY ("vehicle_id") REFERENCES "vehicle"("id"),
        CONSTRAINT "FK_access_request_user_id" FOREIGN KEY ("user_id") REFERENCES "user"("id"),
        CONSTRAINT "FK_access_request_authorized_by" FOREIGN KEY ("authorized_by") REFERENCES "user"("id"),
        CONSTRAINT "FK_access_request_requested_by" FOREIGN KEY ("requested_by") REFERENCES "user"("id"),
        CONSTRAINT "FK_access_request_handled_by" FOREIGN KEY ("handled_by") REFERENCES "user"("id"),
        CONSTRAINT "FK_access_request_department_id" FOREIGN KEY ("department_id") REFERENCES "department"("id"),
        CONSTRAINT "FK_access_request_resolved_user_id" FOREIGN KEY ("resolved_user_id") REFERENCES "user"("id"),
        CONSTRAINT "FK_access_request_resolved_vehicle_id" FOREIGN KEY ("resolved_vehicle_id") REFERENCES "vehicle"("id")
      )
    `);
    await queryRunner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS "UQ_access_request_company_plate_open"
       ON "access_request" ("company_id", "plate")
       WHERE "status" IN ('PENDING', 'IN_CONTACT')`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_access_request_company_status" ON "access_request" ("company_id", "status")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_access_request_company_plate_status" ON "access_request" ("company_id", "plate", "status")`,
    );

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "device" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "company_id" uuid NOT NULL,
        "name" varchar(100) NOT NULL,
        "token" varchar(64) NOT NULL,
        "platform" device_platform NOT NULL,
        "app_version" varchar(32) NULL,
        "entrance_id" uuid NULL,
        "last_sync_at" timestamptz NULL,
        "is_active" boolean NOT NULL DEFAULT true,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_device_id" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_device_company_token" UNIQUE ("company_id", "token"),
        CONSTRAINT "FK_device_company_id" FOREIGN KEY ("company_id") REFERENCES "company"("id"),
        CONSTRAINT "FK_device_entrance_id" FOREIGN KEY ("entrance_id") REFERENCES "entrance"("id")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "import_job" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "company_id" uuid NOT NULL,
        "type" import_job_type NOT NULL,
        "status" import_job_status NOT NULL DEFAULT 'PENDING',
        "file_url" varchar(512) NULL,
        "created_by" uuid NULL,
        "errors" jsonb NOT NULL DEFAULT '[]',
        "total_rows" integer NOT NULL DEFAULT 0,
        "processed_rows" integer NOT NULL DEFAULT 0,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_import_job_id" PRIMARY KEY ("id"),
        CONSTRAINT "FK_import_job_company_id" FOREIGN KEY ("company_id") REFERENCES "company"("id"),
        CONSTRAINT "FK_import_job_created_by" FOREIGN KEY ("created_by") REFERENCES "user"("id")
      )
    `);

    await queryRunner.query(`
      ALTER TABLE "vehicle_access"
        ADD CONSTRAINT "FK_vehicle_access_access_request_id"
        FOREIGN KEY ("access_request_id") REFERENCES "access_request"("id")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "vehicle_access" DROP CONSTRAINT IF EXISTS "FK_vehicle_access_access_request_id"`,
    );
    await queryRunner.query(`DROP TABLE IF EXISTS "import_job" CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS "device" CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS "access_request" CASCADE`);
    await queryRunner.query(`DROP TYPE IF EXISTS "import_job_status"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "import_job_type"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "device_platform"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "contact_channel"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "access_request_status"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "access_request_type"`);
  }
}
