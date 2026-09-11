import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Permite Visitante **sem credenciais** (ADR 0013): `user.email` e
 * `user.password` passam a aceitar `NULL`.
 *
 * O e-mail continua **único quando não nulo** (`UQ_user_email` permanece) — o
 * Postgres permite vários `NULL` numa coluna única. Sem backfill: as pessoas
 * existentes mantêm os valores atuais.
 *
 * O `down` restaura `NOT NULL`, então só é executável quando não houver
 * registros com `NULL` (comportamento aceito: reverter a decisão exige
 * preencher as credenciais antes).
 */
export class UserCredentialsNullable1760000000011 implements MigrationInterface {
  name = 'UserCredentialsNullable1760000000011';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "user" ALTER COLUMN "email" DROP NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "user" ALTER COLUMN "password" DROP NOT NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "user" ALTER COLUMN "email" SET NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "user" ALTER COLUMN "password" SET NOT NULL`,
    );
  }
}
