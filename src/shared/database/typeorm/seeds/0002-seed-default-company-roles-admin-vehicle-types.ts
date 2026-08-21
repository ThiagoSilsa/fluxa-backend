import { hashSync } from 'bcrypt';
import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Seed dos dados base da empresa padrão (SOMAR): empresa, cargos
 * (Administração, Segurança, Presidência, Porteiro) com o mapeamento inicial
 * de permissões, usuário admin (bcrypt via ADMIN_DEFAULT_*) e os tipos de
 * veículo padrão (FROTA, PARTICULAR).
 *
 * Idempotente (ON CONFLICT / WHERE NOT EXISTS) e com IDs fixos para os dados
 * seedados — conforme planejamento, ADR 0001 e ADR 0002 (admin = pessoa em
 * `user` + vínculo `user_company` com type/is_active).
 */
export class SeedDefaultCompanyRolesAdminVehicleTypes1760001000001 implements MigrationInterface {
  name = 'SeedDefaultCompanyRolesAdminVehicleTypes1760001000001';

  private static readonly COMPANY_ID = '10000000-0000-0000-0000-000000000001';
  private static readonly ADMIN_USER_ID =
    '30000000-0000-0000-0000-000000000001';

  private static readonly ROLES: ReadonlyArray<{
    id: string;
    name: string;
    description: string;
    isAdmin: boolean;
  }> = [
    {
      id: '20000000-0000-0000-0000-000000000001',
      name: 'Administração',
      description: 'Administração da empresa (acesso total)',
      isAdmin: true,
    },
    {
      id: '20000000-0000-0000-0000-000000000002',
      name: 'Segurança',
      description: 'Segurança da portaria (inclui gestão de bloqueios)',
      isAdmin: false,
    },
    {
      id: '20000000-0000-0000-0000-000000000003',
      name: 'Presidência',
      description: 'Presidência (consultas e privilégios restritos)',
      isAdmin: false,
    },
    {
      id: '20000000-0000-0000-0000-000000000004',
      name: 'Porteiro',
      description: 'Porteiro da portaria (registro de entradas e saídas)',
      isAdmin: false,
    },
  ];

  private static readonly ROLE_PERMISSIONS: ReadonlyArray<{
    roleId: string;
    codes: ReadonlyArray<string>;
  }> = [
    {
      roleId: '20000000-0000-0000-0000-000000000004', // Porteiro
      codes: [
        'REGISTER_ENTRY',
        'REGISTER_EXIT',
        'REGISTER_DENIAL',
        'CREATE_ACCESS_REQUEST',
        'CANCEL_ACCESS_REQUEST',
        'CREATE_BLOCK_REQUEST',
        'VIEW_DASHBOARDS',
      ],
    },
    {
      roleId: '20000000-0000-0000-0000-000000000002', // Segurança
      codes: [
        'REGISTER_ENTRY',
        'REGISTER_EXIT',
        'REGISTER_DENIAL',
        'CREATE_ACCESS_REQUEST',
        'CANCEL_ACCESS_REQUEST',
        'CREATE_BLOCK_REQUEST',
        'VIEW_DASHBOARDS',
        'MANAGE_BLOCKS',
      ],
    },
    {
      roleId: '20000000-0000-0000-0000-000000000003', // Presidência
      codes: ['VIEW_DASHBOARDS', 'GRANT_FREE_PASS', 'MANAGE_BLOCKS'],
    },
    {
      roleId: '20000000-0000-0000-0000-000000000001', // Administração (todas)
      codes: [
        'MANAGE_COMPANY',
        'MANAGE_USERS',
        'MANAGE_ROLES',
        'MANAGE_VEHICLES',
        'MANAGE_VEHICLE_TYPES',
        'MANAGE_DEPARTMENTS',
        'MANAGE_ENTRANCES',
        'MANAGE_BLOCKS',
        'MANAGE_ACCESS_REQUESTS',
        'MANAGE_BLOCK_REQUESTS',
        'MANAGE_IMPORTS',
        'MANAGE_DEVICES',
        'GRANT_FREE_PASS',
        'PRINT_QRCODE',
        'VIEW_DASHBOARDS',
        'REGISTER_ENTRY',
        'REGISTER_EXIT',
        'REGISTER_DENIAL',
        'CREATE_ACCESS_REQUEST',
        'CANCEL_ACCESS_REQUEST',
        'CREATE_BLOCK_REQUEST',
        'MANUAL_CLOSE_ACCESS',
        'INITIAL_ENTRY',
      ],
    },
  ];

  public async up(queryRunner: QueryRunner): Promise<void> {
    await this.insertCompany(queryRunner);
    await this.insertRoles(queryRunner);
    await this.insertRolePermissions(queryRunner);
    await this.insertAdminUser(queryRunner);
    await this.insertVehicleTypes(queryRunner);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const companyId =
      SeedDefaultCompanyRolesAdminVehicleTypes1760001000001.COMPANY_ID;
    const adminUserId =
      SeedDefaultCompanyRolesAdminVehicleTypes1760001000001.ADMIN_USER_ID;
    await queryRunner.query(`DELETE FROM "user_role" WHERE "company_id" = $1`, [
      companyId,
    ]);
    await queryRunner.query(
      `DELETE FROM "role_permission" WHERE "company_id" = $1`,
      [companyId],
    );
    // Remove o vínculo antes da pessoa (FK de user_company → user bloqueia o
    // DELETE em "user").
    await queryRunner.query(
      `DELETE FROM "user_company" WHERE "company_id" = $1`,
      [companyId],
    );
    await queryRunner.query(`DELETE FROM "user" WHERE "id" = $1`, [
      adminUserId,
    ]);
    await queryRunner.query(`DELETE FROM "role" WHERE "company_id" = $1`, [
      companyId,
    ]);
    await queryRunner.query(
      `DELETE FROM "vehicle_type" WHERE "company_id" = $1`,
      [companyId],
    );
    await queryRunner.query(`DELETE FROM "company" WHERE "id" = $1`, [
      companyId,
    ]);
  }

  private async insertCompany(queryRunner: QueryRunner): Promise<void> {
    const companyId =
      SeedDefaultCompanyRolesAdminVehicleTypes1760001000001.COMPANY_ID;
    await queryRunner.query(
      `INSERT INTO "company" ("id", "name", "is_active", "timezone")
       VALUES ($1, 'SOMAR', true, 'America/Sao_Paulo')
       ON CONFLICT ("id") DO NOTHING`,
      [companyId],
    );
  }

  private async insertRoles(queryRunner: QueryRunner): Promise<void> {
    const companyId =
      SeedDefaultCompanyRolesAdminVehicleTypes1760001000001.COMPANY_ID;
    const roles = SeedDefaultCompanyRolesAdminVehicleTypes1760001000001.ROLES;
    const values = roles
      .map(
        (_, index) =>
          `($${index * 5 + 1}, $${index * 5 + 2}, $${index * 5 + 3}, $${index * 5 + 4}, $${index * 5 + 5}, true)`,
      )
      .join(', ');
    const params = roles.flatMap((role) => [
      role.id,
      companyId,
      role.name,
      role.description,
      role.isAdmin,
    ]);

    await queryRunner.query(
      `INSERT INTO "role" ("id", "company_id", "name", "description", "is_admin", "is_active")
       VALUES ${values}
       ON CONFLICT ("id") DO NOTHING`,
      params,
    );
  }

  private async insertRolePermissions(queryRunner: QueryRunner): Promise<void> {
    const companyId =
      SeedDefaultCompanyRolesAdminVehicleTypes1760001000001.COMPANY_ID;
    const entries =
      SeedDefaultCompanyRolesAdminVehicleTypes1760001000001.ROLE_PERMISSIONS;

    for (const entry of entries) {
      const placeholders = entry.codes
        .map((_, index) => `$${index + 3}`)
        .join(', ');
      await queryRunner.query(
        `INSERT INTO "role_permission" ("id", "company_id", "role_id", "permission_id")
         SELECT gen_random_uuid(), $1, $2, "p"."id"
         FROM "permission" AS "p"
         WHERE "p"."code" IN (${placeholders})
         ON CONFLICT ("company_id", "role_id", "permission_id") DO NOTHING`,
        [companyId, entry.roleId, ...entry.codes],
      );
    }
  }

  private async insertAdminUser(queryRunner: QueryRunner): Promise<void> {
    const companyId =
      SeedDefaultCompanyRolesAdminVehicleTypes1760001000001.COMPANY_ID;
    const adminUserId =
      SeedDefaultCompanyRolesAdminVehicleTypes1760001000001.ADMIN_USER_ID;
    const email = process.env.ADMIN_DEFAULT_EMAIL ?? 'admin@somar.local';
    const password = process.env.ADMIN_DEFAULT_PASSWORD ?? 'admin123';
    const passwordHash: string = hashSync(password, 10);

    // Pessoa (identidade) — sem company_id; type/is_active vivem no vínculo
    // (ADR 0002).
    await queryRunner.query(
      `INSERT INTO "user" ("id", "name", "email", "password")
       VALUES ($1, 'Administrador', $2, $3)
       ON CONFLICT ("id") DO NOTHING`,
      [adminUserId, email, passwordHash],
    );

    // Vínculo pessoa ↔ empresa (ADR 0002).
    await queryRunner.query(
      `INSERT INTO "user_company" ("id", "user_id", "company_id", "type", "is_active")
       VALUES (gen_random_uuid(), $1, $2, 'EMPLOYEE', true)
       ON CONFLICT ("user_id", "company_id") DO NOTHING`,
      [adminUserId, companyId],
    );

    await queryRunner.query(
      `INSERT INTO "user_role" ("id", "company_id", "user_id", "role_id")
       VALUES (gen_random_uuid(), $1, $2, '20000000-0000-0000-0000-000000000001')
       ON CONFLICT ("company_id", "user_id") DO NOTHING`,
      [companyId, adminUserId],
    );
  }

  private async insertVehicleTypes(queryRunner: QueryRunner): Promise<void> {
    const companyId =
      SeedDefaultCompanyRolesAdminVehicleTypes1760001000001.COMPANY_ID;
    await queryRunner.query(
      `INSERT INTO "vehicle_type" ("id", "company_id", "code", "name", "is_fleet", "is_active")
       VALUES
         ('40000000-0000-0000-0000-000000000001', $1, 'FROTA', 'Frota', true, true),
         ('40000000-0000-0000-0000-000000000002', $1, 'PARTICULAR', 'Particular', false, true)
       ON CONFLICT ("company_id", "code") DO NOTHING`,
      [companyId],
    );
  }
}
