import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Cria o schema de catálogo de veículos: vehicle_type, vehicle, department,
 * vehicle_department, user_vehicle e vehicle_qr_code — com uniques compostos
 * por empresa e uniques parciais (1 proprietário primário por veículo e 1 QR
 * ativo por veículo).
 *
 * SQL cru e idempotente, com nomes explícitos de constraints/índices
 * (PK_/UQ_/IDX_/FK_) e down() simétrico — conforme ADR 0001 e AGENTS.md.
 */
export class CreateVehicleCatalogSchema1760000000001 implements MigrationInterface {
  name = 'CreateVehicleCatalogSchema1760000000001';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "vehicle_type" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "company_id" uuid NOT NULL,
        "code" varchar(50) NOT NULL,
        "name" varchar(100) NOT NULL,
        "description" text NULL,
        "is_fleet" boolean NOT NULL DEFAULT false,
        "is_active" boolean NOT NULL DEFAULT true,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_vehicle_type_id" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_vehicle_type_company_id_code" UNIQUE ("company_id", "code"),
        CONSTRAINT "FK_vehicle_type_company_id" FOREIGN KEY ("company_id") REFERENCES "company"("id")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "vehicle" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "plate" varchar(10) NOT NULL,
        "company_id" uuid NOT NULL,
        "model" varchar(100) NULL,
        "color" varchar(50) NULL,
        "observation" text NULL,
        "is_blocked" boolean NOT NULL DEFAULT false,
        "free_pass" boolean NOT NULL DEFAULT false,
        "vehicle_type_id" uuid NOT NULL,
        "is_active" boolean NOT NULL DEFAULT true,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_vehicle_id" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_vehicle_company_id_plate" UNIQUE ("company_id", "plate"),
        CONSTRAINT "FK_vehicle_company_id" FOREIGN KEY ("company_id") REFERENCES "company"("id"),
        CONSTRAINT "FK_vehicle_vehicle_type_id" FOREIGN KEY ("vehicle_type_id") REFERENCES "vehicle_type"("id")
      )
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_vehicle_company_id_vehicle_type_id" ON "vehicle" ("company_id", "vehicle_type_id")`,
    );

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "department" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "name" varchar(100) NOT NULL,
        "company_id" uuid NOT NULL,
        "description" text NULL,
        "parking_space" integer NOT NULL DEFAULT 0,
        "is_active" boolean NOT NULL DEFAULT true,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_department_id" PRIMARY KEY ("id"),
        CONSTRAINT "FK_department_company_id" FOREIGN KEY ("company_id") REFERENCES "company"("id")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "vehicle_department" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "company_id" uuid NOT NULL,
        "vehicle_id" uuid NOT NULL,
        "department_id" uuid NOT NULL,
        "is_active" boolean NOT NULL DEFAULT true,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_vehicle_department_id" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_vehicle_department_company_vehicle" UNIQUE ("company_id", "vehicle_id"),
        CONSTRAINT "FK_vehicle_department_company_id" FOREIGN KEY ("company_id") REFERENCES "company"("id"),
        CONSTRAINT "FK_vehicle_department_vehicle_id" FOREIGN KEY ("vehicle_id") REFERENCES "vehicle"("id"),
        CONSTRAINT "FK_vehicle_department_department_id" FOREIGN KEY ("department_id") REFERENCES "department"("id")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "user_vehicle" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "company_id" uuid NOT NULL,
        "user_id" uuid NOT NULL,
        "vehicle_id" uuid NOT NULL,
        "is_primary" boolean NOT NULL DEFAULT false,
        "can_drive" boolean NOT NULL DEFAULT true,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_user_vehicle_id" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_user_vehicle_company_user_vehicle" UNIQUE ("company_id", "user_id", "vehicle_id"),
        CONSTRAINT "FK_user_vehicle_company_id" FOREIGN KEY ("company_id") REFERENCES "company"("id"),
        CONSTRAINT "FK_user_vehicle_user_id" FOREIGN KEY ("user_id") REFERENCES "user"("id"),
        CONSTRAINT "FK_user_vehicle_vehicle_id" FOREIGN KEY ("vehicle_id") REFERENCES "vehicle"("id")
      )
    `);
    await queryRunner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS "UQ_user_vehicle_company_vehicle_primary_true"
       ON "user_vehicle" ("company_id", "vehicle_id")
       WHERE "is_primary" = true`,
    );

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "vehicle_qr_code" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "company_id" uuid NOT NULL,
        "vehicle_id" uuid NOT NULL,
        "code" varchar(64) NOT NULL,
        "is_active" boolean NOT NULL DEFAULT true,
        "issued_by" uuid NULL,
        "printed_at" timestamptz NULL,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_vehicle_qr_code_id" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_vehicle_qr_code_company_code" UNIQUE ("company_id", "code"),
        CONSTRAINT "FK_vehicle_qr_code_company_id" FOREIGN KEY ("company_id") REFERENCES "company"("id"),
        CONSTRAINT "FK_vehicle_qr_code_vehicle_id" FOREIGN KEY ("vehicle_id") REFERENCES "vehicle"("id"),
        CONSTRAINT "FK_vehicle_qr_code_issued_by" FOREIGN KEY ("issued_by") REFERENCES "user"("id")
      )
    `);
    await queryRunner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS "UQ_vehicle_qr_code_company_vehicle_active_true"
       ON "vehicle_qr_code" ("company_id", "vehicle_id")
       WHERE "is_active" = true`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "vehicle_qr_code" CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS "user_vehicle" CASCADE`);
    await queryRunner.query(
      `DROP TABLE IF EXISTS "vehicle_department" CASCADE`,
    );
    await queryRunner.query(`DROP TABLE IF EXISTS "department" CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS "vehicle" CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS "vehicle_type" CASCADE`);
  }
}
