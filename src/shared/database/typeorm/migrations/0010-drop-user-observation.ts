import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Remove a coluna `user.observation` (dado pessoal desnecessário — decisão de
 * simplificação: usuários são vinculados via empresas e a observação não faz
 * sentido no fluxo de gestão).
 *
 * A remoção é idempotente (`IF EXISTS`) e o down recria a coluna como `text`
 * (sem restaurar dados — decisão de limpeza).
 */
export class DropUserObservation1760000000009 implements MigrationInterface {
  name = 'DropUserObservation1760000000009';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "user" DROP COLUMN IF EXISTS "observation"`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "user" ADD COLUMN "observation" text`);
  }
}
