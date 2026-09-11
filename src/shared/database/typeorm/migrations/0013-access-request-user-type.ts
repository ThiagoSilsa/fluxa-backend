import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Registra o **tipo de usuário** pretendido para o motorista na solicitação de
 * acesso (ADR 0013): `access_request.user_type` reutiliza o enum `user_type`
 * já existente (`EMPLOYEE`/`VISITOR`), `NOT NULL DEFAULT 'VISITOR'`.
 *
 * Sem backfill: as solicitações existentes assumem `VISITOR`. Sem índice — a
 * coluna não é filtro de listagem (o tipo é exibido, não usado para escopar),
 * então um índice só custaria escrita.
 */
export class AddAccessRequestUserType1760000000012 implements MigrationInterface {
  name = 'AddAccessRequestUserType1760000000012';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "access_request" ADD COLUMN IF NOT EXISTS "user_type" "user_type" NOT NULL DEFAULT 'VISITOR'`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "access_request" DROP COLUMN IF EXISTS "user_type"`,
    );
  }
}
