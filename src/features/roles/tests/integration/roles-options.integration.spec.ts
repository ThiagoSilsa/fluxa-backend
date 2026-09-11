// Supertest
import request from 'supertest';

// Types
import type { DataSource } from 'typeorm';

// Auth (dados seedados compartilhados — para copiar a senha do admin)
import { AUTH_SEEDED } from '../../../auth/tests/integration/support/auth-integration-context';

// Support
import {
  createRolesIntegrationContext,
  ROLES_SEEDED,
  RolesIntegrationContext,
} from './support/roles-integration-context';

jest.setTimeout(120000);

/**
 * Endpoint de seleção de baixo privilégio (ADR 0011) — `GET /roles/options`,
 * acessível a quem aceita solicitação de acesso (`MANAGE_ACCESS_REQUESTS`) OU
 * gerencia usuários (`MANAGE_USERS`), sem exigir `MANAGE_ROLES`.
 */
describe('Roles integration — GET /roles/options (seleção de baixo privilégio)', () => {
  let context: RolesIntegrationContext;
  let aceiteToken: string;
  let usuariosToken: string;
  let porteiroToken: string;
  let adminToken: string;

  const ACCESS_ROLE_NAME = 'Cargo aceite options';
  const USERS_ROLE_NAME = 'Cargo usuarios options';
  const INACTIVE_ROLE_NAME = 'Cargo inativo options';
  const SECOND_COMPANY_ROLE_NAME = 'Cargo empresa 2';

  beforeAll(async () => {
    context = await createRolesIntegrationContext();

    adminToken = await context.loginAndGetToken(
      ROLES_SEEDED.ADMIN_EMAIL,
      ROLES_SEEDED.ADMIN_PASSWORD,
    );

    // Perfil que aceita solicitação de acesso.
    const accessRoleId = await createRoleWithPermissions(
      context,
      ACCESS_ROLE_NAME,
      ['MANAGE_ACCESS_REQUESTS'],
    );
    await context.seedUserWithRole('aceite.options@teste.local', accessRoleId);
    aceiteToken = await context.loginAndGetToken(
      'aceite.options@teste.local',
      ROLES_SEEDED.ADMIN_PASSWORD,
    );

    // Perfil que gerencia usuários.
    const usersRoleId = await createRoleWithPermissions(
      context,
      USERS_ROLE_NAME,
      ['MANAGE_USERS'],
    );
    await context.seedUserWithRole('usuarios.options@teste.local', usersRoleId);
    usuariosToken = await context.loginAndGetToken(
      'usuarios.options@teste.local',
      ROLES_SEEDED.ADMIN_PASSWORD,
    );

    // Perfil sem nenhuma das permissões aceitas (Porteiro).
    await context.seedUserWithRole(
      'porteiro.options@teste.local',
      ROLES_SEEDED.PORTEIRO_ROLE_ID,
    );
    porteiroToken = await context.loginAndGetToken(
      'porteiro.options@teste.local',
      ROLES_SEEDED.ADMIN_PASSWORD,
    );

    // Cargo inativo — não deve aparecer nas opções.
    await createRoleWithPermissions(
      context,
      INACTIVE_ROLE_NAME,
      ['MANAGE_USERS'],
      false,
    );
  });

  beforeEach(() => {
    context.resetThrottle();
  });

  afterAll(async () => {
    await context.close();
  });

  it('retorna 200 para quem aceita solicitação (MANAGE_ACCESS_REQUESTS)', async () => {
    const res = await request(context.httpServer)
      .get('/roles/options?limit=100&offset=0')
      .set('Authorization', `Bearer ${aceiteToken}`)
      .expect(200);

    expect(res.body).toMatchObject({ limit: 100, offset: 0 });
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(typeof res.body.count).toBe('number');
    expect(res.body.data).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: ACCESS_ROLE_NAME }),
      ]),
    );
  });

  it('retorna 200 para quem gerencia usuários (MANAGE_USERS)', async () => {
    const res = await request(context.httpServer)
      .get('/roles/options')
      .set('Authorization', `Bearer ${usuariosToken}`)
      .expect(200);

    expect(res.body.data).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: USERS_ROLE_NAME }),
      ]),
    );
  });

  it('devolve itens enxutos apenas com { id, name }', async () => {
    const res = await request(context.httpServer)
      .get('/roles/options?limit=100')
      .set('Authorization', `Bearer ${aceiteToken}`)
      .expect(200);

    expect(res.body.data.length).toBeGreaterThan(0);
    for (const item of res.body.data) {
      expect(Object.keys(item).sort()).toEqual(['id', 'name']);
      expect(typeof item.name).toBe('string');
    }
  });

  it('não devolve cargos inativos', async () => {
    const res = await request(context.httpServer)
      .get('/roles/options?limit=100')
      .set('Authorization', `Bearer ${aceiteToken}`)
      .expect(200);

    expect(
      res.body.data.some(
        (role: { name: string }) => role.name === INACTIVE_ROLE_NAME,
      ),
    ).toBe(false);
  });

  it('is_admin tem acesso total (bypass do guard — ADR 0004)', async () => {
    await request(context.httpServer)
      .get('/roles/options')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
  });

  it('devolve 401 sem token', async () => {
    await request(context.httpServer).get('/roles/options').expect(401);
  });

  it('devolve 403 para quem não aceita solicitação nem gerencia usuários', async () => {
    await request(context.httpServer)
      .get('/roles/options')
      .set('Authorization', `Bearer ${porteiroToken}`)
      .expect(403);
  });

  it('não vaza cargos de outra empresa (isolamento multi-tenant)', async () => {
    const { email } = await seedSecondCompanyWithRoleUser(
      context,
      SECOND_COMPANY_ROLE_NAME,
    );
    const otherToken = await context.loginAndGetToken(
      email,
      ROLES_SEEDED.ADMIN_PASSWORD,
    );

    const res = await request(context.httpServer)
      .get('/roles/options?limit=100')
      .set('Authorization', `Bearer ${otherToken}`)
      .expect(200);

    const names = res.body.data.map((role: { name: string }) => role.name);
    expect(names).toContain(SECOND_COMPANY_ROLE_NAME);
    expect(names).not.toContain('Administração');
  });
});

/**
 * Cria um cargo na SOMAR com as permissões informadas.
 *
 * @param context Contexto de integração.
 * @param name Nome do cargo.
 * @param codes Códigos de permissão do catálogo global.
 * @param isActive Status do cargo (default ativo).
 * @returns Id do cargo criado.
 */
async function createRoleWithPermissions(
  context: RolesIntegrationContext,
  name: string,
  codes: string[],
  isActive = true,
): Promise<string> {
  const rows = await context.dataSource.query(
    `INSERT INTO "role" ("id", "company_id", "name", "description", "is_admin", "is_active")
     VALUES (gen_random_uuid(), $1, $2, '', false, $3)
     RETURNING "id"`,
    [ROLES_SEEDED.SOMAR_COMPANY_ID, name, isActive],
  );
  const roleId = rows[0]?.id as string | undefined;
  if (!roleId) {
    throw new Error('Falha ao criar cargo de teste.');
  }

  for (const code of codes) {
    await context.dataSource.query(
      `INSERT INTO "role_permission" ("id", "company_id", "role_id", "permission_id")
       SELECT gen_random_uuid(), $1, $2, "id"
       FROM "permission" WHERE "code" = $3`,
      [ROLES_SEEDED.SOMAR_COMPANY_ID, roleId, code],
    );
  }

  return roleId;
}

/**
 * Cria uma segunda empresa com um cargo (MANAGE_ACCESS_REQUESTS) e um usuário
 * vinculado — para provar o isolamento multi-tenant do endpoint.
 *
 * @param context Contexto de integração.
 * @param roleName Nome do cargo da segunda empresa.
 * @returns E-mail do usuário criado na segunda empresa.
 */
async function seedSecondCompanyWithRoleUser(
  context: RolesIntegrationContext,
  roleName: string,
): Promise<{ email: string }> {
  const dataSource: DataSource = context.dataSource;

  const companyRows = await dataSource.query(
    `INSERT INTO "company" ("id", "name", "is_active")
     VALUES (gen_random_uuid(), 'Empresa 2', true)
     RETURNING "id"`,
  );
  const companyId = companyRows[0]?.id as string;

  const roleRows = await dataSource.query(
    `INSERT INTO "role" ("id", "company_id", "name", "description", "is_admin", "is_active")
     VALUES (gen_random_uuid(), $1, $2, '', false, true)
     RETURNING "id"`,
    [companyId, roleName],
  );
  const roleId = roleRows[0]?.id as string;

  await dataSource.query(
    `INSERT INTO "role_permission" ("id", "company_id", "role_id", "permission_id")
     SELECT gen_random_uuid(), $1, $2, "id"
     FROM "permission" WHERE "code" = $3`,
    [companyId, roleId, 'MANAGE_ACCESS_REQUESTS'],
  );

  const email = 'empresa2.options@teste.local';
  const userRows = await dataSource.query(
    `INSERT INTO "user" ("id", "name", "email", "password")
     SELECT gen_random_uuid(), $1, $2, "password"
     FROM "user" WHERE "id" = $3
     RETURNING "id"`,
    ['Usuário empresa 2', email, AUTH_SEEDED.ADMIN_USER_ID],
  );
  const userId = userRows[0]?.id as string;

  await dataSource.query(
    `INSERT INTO "user_company" ("id", "user_id", "company_id", "type", "is_active")
     VALUES (gen_random_uuid(), $1, $2, 'EMPLOYEE', true)`,
    [userId, companyId],
  );
  await dataSource.query(
    `INSERT INTO "user_role" ("id", "company_id", "user_id", "role_id")
     VALUES (gen_random_uuid(), $1, $2, $3)`,
    [companyId, userId, roleId],
  );

  return { email };
}
