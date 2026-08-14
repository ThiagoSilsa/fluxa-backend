import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Seed do catálogo global de permissões (tabela "permission", sem company_id).
 * Insere as 23 permissões iniciais do MVP de forma idempotente
 * (ON CONFLICT ("code") DO NOTHING) — conforme planejamento e ADR 0001.
 */
export class SeedInitialPermissions1760001000000 implements MigrationInterface {
  name = 'SeedInitialPermissions1760001000000';

  private static readonly PERMISSIONS: ReadonlyArray<{
    code: string;
    description: string;
  }> = [
    { code: 'MANAGE_COMPANY', description: 'Gerenciar dados da empresa' },
    { code: 'MANAGE_USERS', description: 'Gerenciar usuários' },
    { code: 'MANAGE_ROLES', description: 'Gerenciar cargos e permissões' },
    { code: 'MANAGE_VEHICLES', description: 'Gerenciar veículos' },
    { code: 'MANAGE_VEHICLE_TYPES', description: 'Gerenciar tipos de veículo' },
    {
      code: 'MANAGE_DEPARTMENTS',
      description: 'Gerenciar departamentos e vagas',
    },
    { code: 'MANAGE_ENTRANCES', description: 'Gerenciar portarias' },
    {
      code: 'MANAGE_BLOCKS',
      description: 'Bloquear e revogar bloqueio de veículos',
    },
    {
      code: 'MANAGE_ACCESS_REQUESTS',
      description: 'Aceitar e rejeitar solicitações de cadastro/vínculo',
    },
    {
      code: 'MANAGE_BLOCK_REQUESTS',
      description: 'Aprovar e rejeitar solicitações de bloqueio',
    },
    {
      code: 'MANAGE_IMPORTS',
      description: 'Gerenciar importações de planilhas',
    },
    { code: 'MANAGE_DEVICES', description: 'Gerenciar dispositivos do app' },
    {
      code: 'GRANT_FREE_PASS',
      description: 'Conceder e revogar livre acesso (free_pass)',
    },
    { code: 'PRINT_QRCODE', description: 'Gerar e imprimir QR codes' },
    { code: 'VIEW_DASHBOARDS', description: 'Visualizar painéis e relatórios' },
    { code: 'REGISTER_ENTRY', description: 'Registrar entrada de veículo' },
    { code: 'REGISTER_EXIT', description: 'Registrar saída de veículo' },
    {
      code: 'REGISTER_DENIAL',
      description: 'Registrar impedimento de entrada',
    },
    {
      code: 'CREATE_ACCESS_REQUEST',
      description: 'Criar solicitação de cadastro/vínculo',
    },
    {
      code: 'CANCEL_ACCESS_REQUEST',
      description: 'Cancelar solicitação própria',
    },
    {
      code: 'CREATE_BLOCK_REQUEST',
      description: 'Solicitar bloqueio de veículo',
    },
    { code: 'MANUAL_CLOSE_ACCESS', description: 'Encerrar acesso manualmente' },
    {
      code: 'INITIAL_ENTRY',
      description: 'Registrar entrada inicial (go-live)',
    },
  ];

  public async up(queryRunner: QueryRunner): Promise<void> {
    const permissions = SeedInitialPermissions1760001000000.PERMISSIONS;
    const values = permissions
      .map((_, index) => `($${index * 2 + 1}, $${index * 2 + 2})`)
      .join(', ');
    const params = permissions.flatMap((permission) => [
      permission.code,
      permission.description,
    ]);

    await queryRunner.query(
      `INSERT INTO "permission" ("code", "description") VALUES ${values}
       ON CONFLICT ("code") DO NOTHING`,
      params,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const codes = SeedInitialPermissions1760001000000.PERMISSIONS.map(
      (permission) => permission.code,
    );
    const placeholders = codes.map((_, index) => `$${index + 1}`).join(', ');

    await queryRunner.query(
      `DELETE FROM "permission" WHERE "code" IN (${placeholders})`,
      codes,
    );
  }
}
