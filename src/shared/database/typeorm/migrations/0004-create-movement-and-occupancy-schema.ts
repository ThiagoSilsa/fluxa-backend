import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Cria o schema de movimento e ocupação: enums (movement_type, movement_source,
 * access_status), occupancy_snapshot, vehicle_access e vehicle_movement.
 *
 * vehicle_access.access_request_id é criada como coluna SEM constraint nesta
 * migração — a FK para access_request é adicionada na migration 0005 (a tabela
 * access_request ainda não existe).
 *
 * SQL cru e idempotente, com nomes explícitos de constraints/índices
 * (PK_/UQ_/IDX_/FK_) e down() simétrico — conforme ADR 0001 e AGENTS.md.
 */
export class CreateMovementAndOccupancySchema1760000000003 implements MigrationInterface {
  name = 'CreateMovementAndOccupancySchema1760000000003';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'movement_type') THEN
          CREATE TYPE "movement_type" AS ENUM ('ENTRY', 'EXIT');
        END IF;
      END
      $$;
    `);
    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'movement_source') THEN
          CREATE TYPE "movement_source" AS ENUM ('APP', 'WEB', 'QRCODE', 'PLATE', 'INITIAL', 'MANUAL');
        END IF;
      END
      $$;
    `);
    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'access_status') THEN
          CREATE TYPE "access_status" AS ENUM ('INSIDE', 'OUT', 'NO_EXIT', 'MANUAL_CLOSED');
        END IF;
      END
      $$;
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "occupancy_snapshot" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "company_id" uuid NOT NULL,
        "date" date NOT NULL,
        "slot_total" integer NOT NULL,
        "slot_occupied" integer NOT NULL,
        "occupancy_by_department" jsonb NOT NULL DEFAULT '[]',
        "peak_occupancy" integer NOT NULL DEFAULT 0,
        "peak_at" timestamptz NULL,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_occupancy_snapshot_id" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_occupancy_snapshot_company_date" UNIQUE ("company_id", "date"),
        CONSTRAINT "FK_occupancy_snapshot_company_id" FOREIGN KEY ("company_id") REFERENCES "company"("id")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "vehicle_access" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "company_id" uuid NOT NULL,
        "vehicle_id" uuid NULL,
        "temporary_plate" varchar(10) NULL,
        "driver_user_id" uuid NULL,
        "temporary_driver_name" varchar(255) NULL,
        "department_id" uuid NULL,
        "access_request_id" uuid NULL,
        "over_capacity" boolean NOT NULL DEFAULT false,
        "status" access_status NOT NULL DEFAULT 'INSIDE',
        "forced_exit" boolean NOT NULL DEFAULT false,
        "entry_at" timestamptz NULL,
        "exit_at" timestamptz NULL,
        "closed_by" uuid NULL,
        "closed_at" timestamptz NULL,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_vehicle_access_id" PRIMARY KEY ("id"),
        CONSTRAINT "FK_vehicle_access_company_id" FOREIGN KEY ("company_id") REFERENCES "company"("id"),
        CONSTRAINT "FK_vehicle_access_vehicle_id" FOREIGN KEY ("vehicle_id") REFERENCES "vehicle"("id"),
        CONSTRAINT "FK_vehicle_access_driver_user_id" FOREIGN KEY ("driver_user_id") REFERENCES "user"("id"),
        CONSTRAINT "FK_vehicle_access_department_id" FOREIGN KEY ("department_id") REFERENCES "department"("id"),
        CONSTRAINT "FK_vehicle_access_closed_by" FOREIGN KEY ("closed_by") REFERENCES "user"("id")
      )
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_vehicle_access_company_status" ON "vehicle_access" ("company_id", "status")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_vehicle_access_company_vehicle_status" ON "vehicle_access" ("company_id", "vehicle_id", "status")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_vehicle_access_company_temporary_plate" ON "vehicle_access" ("company_id", "temporary_plate")`,
    );

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "vehicle_movement" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "company_id" uuid NOT NULL,
        "access_id" uuid NULL,
        "vehicle_id" uuid NULL,
        "type" movement_type NOT NULL,
        "occurred_at" timestamptz NOT NULL,
        "plate_snapshot" varchar(10) NOT NULL,
        "driver_user_id" uuid NULL,
        "department_id" uuid NULL,
        "source" movement_source NOT NULL,
        "entrance_id" uuid NULL,
        "doorman_id" uuid NULL,
        "sync_status" sync_status NOT NULL DEFAULT 'PENDING',
        "idempotency_key" uuid NOT NULL,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_vehicle_movement_id" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_vehicle_movement_company_idempotency_key" UNIQUE ("company_id", "idempotency_key"),
        CONSTRAINT "FK_vehicle_movement_company_id" FOREIGN KEY ("company_id") REFERENCES "company"("id"),
        CONSTRAINT "FK_vehicle_movement_access_id" FOREIGN KEY ("access_id") REFERENCES "vehicle_access"("id"),
        CONSTRAINT "FK_vehicle_movement_vehicle_id" FOREIGN KEY ("vehicle_id") REFERENCES "vehicle"("id"),
        CONSTRAINT "FK_vehicle_movement_driver_user_id" FOREIGN KEY ("driver_user_id") REFERENCES "user"("id"),
        CONSTRAINT "FK_vehicle_movement_department_id" FOREIGN KEY ("department_id") REFERENCES "department"("id"),
        CONSTRAINT "FK_vehicle_movement_entrance_id" FOREIGN KEY ("entrance_id") REFERENCES "entrance"("id"),
        CONSTRAINT "FK_vehicle_movement_doorman_id" FOREIGN KEY ("doorman_id") REFERENCES "user"("id")
      )
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_vehicle_movement_company_occurred_at" ON "vehicle_movement" ("company_id", "occurred_at")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_vehicle_movement_company_plate_snapshot" ON "vehicle_movement" ("company_id", "plate_snapshot")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_vehicle_movement_company_vehicle_occurred_at" ON "vehicle_movement" ("company_id", "vehicle_id", "occurred_at")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "vehicle_movement" CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS "vehicle_access" CASCADE`);
    await queryRunner.query(
      `DROP TABLE IF EXISTS "occupancy_snapshot" CASCADE`,
    );
    await queryRunner.query(`DROP TYPE IF EXISTS "access_status"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "movement_source"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "movement_type"`);
  }
}
