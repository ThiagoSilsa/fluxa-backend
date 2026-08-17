// Supertest
import request from 'supertest';

// Support
import {
  createUsersIntegrationContext,
  USERS_SEEDED,
  UsersIntegrationContext,
} from './support/users-integration-context';

jest.setTimeout(120000);

describe('Users integration — edição/desativação (Testcontainers)', () => {
  let context: UsersIntegrationContext;
  let token: string;
  let porteiroId: string | null;
  let segurancaId: string | null;

  const createUser = (email: string, name: string): request.Test =>
    request(context.httpServer)
      .post('/users')
      .set('Authorization', `Bearer ${token}`)
      .send({ name, email, password: 'senha123', type: 'EMPLOYEE' });

  /**
   * Cria um cargo com a permissão `MANAGE_USERS` e um usuário vinculado —
   * gestor que gerencia usuários **sem** ser administrador.
   *
   * @param email E-mail do gestor.
   * @returns Token do gestor.
   */
  const seedGestorToken = async (email: string): Promise<string> => {
    const roleRes = await request(context.httpServer)
      .post('/roles')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Gestor de Usuários' })
      .expect(201);
    const roleId = roleRes.body.id;

    const permissionId = await context.findPermissionIdByCode('MANAGE_USERS');
    await request(context.httpServer)
      .post(`/roles/${roleId}/permissions`)
      .set('Authorization', `Bearer ${token}`)
      .send({ permissionId })
      .expect(201);

    await context.seedUserWithRole(email, roleId);
    return context.loginAndGetToken(email, USERS_SEEDED.ADMIN_PASSWORD);
  };

  beforeAll(async () => {
    context = await createUsersIntegrationContext();
    token = await context.loginAndGetToken(
      USERS_SEEDED.ADMIN_EMAIL,
      USERS_SEEDED.ADMIN_PASSWORD,
    );
    porteiroId = await context.findRoleIdByName('Porteiro');
    segurancaId = await context.findRoleIdByName('Segurança');
  });

  afterAll(async () => {
    await context.close();
  });

  it('PATCH /users/:id edita parcialmente (nome)', async () => {
    const created = await createUser('edita@somar.local', 'Edita').expect(201);

    const res = await request(context.httpServer)
      .patch(`/users/${created.body.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Edita Silva' })
      .expect(200);

    expect(res.body).toMatchObject({
      id: created.body.id,
      name: 'Edita Silva',
    });
  });

  it('PATCH /users/:id com roleId troca o cargo (replace do cargo único)', async () => {
    const created = await createUser('troca@somar.local', 'Troca').expect(201);

    // cargo inicial via endpoint próprio
    await request(context.httpServer)
      .post(`/users/${created.body.id}/roles`)
      .set('Authorization', `Bearer ${token}`)
      .send({ roleId: porteiroId })
      .expect(201);

    // troca por outro cargo (não-admin — mantém a invariante do último admin)
    const res = await request(context.httpServer)
      .patch(`/users/${created.body.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ roleId: segurancaId })
      .expect(200);

    expect(res.body.role).toMatchObject({
      roleId: segurancaId,
      roleName: 'Segurança',
      isAdmin: false,
    });

    const roles = await request(context.httpServer)
      .get(`/users/${created.body.id}/roles`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(roles.body.roles).toHaveLength(1);
    expect(roles.body.roles[0].roleId).toBe(segurancaId);
  });

  it('PATCH /users/:id com roleId null remove o cargo', async () => {
    const created = await createUser(
      'semrole-edit@somar.local',
      'Sem Role',
    ).expect(201);
    await request(context.httpServer)
      .post(`/users/${created.body.id}/roles`)
      .set('Authorization', `Bearer ${token}`)
      .send({ roleId: porteiroId })
      .expect(201);

    const res = await request(context.httpServer)
      .patch(`/users/${created.body.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ roleId: null })
      .expect(200);

    expect(res.body.role).toBeNull();

    const roles = await request(context.httpServer)
      .get(`/users/${created.body.id}/roles`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(roles.body.roles).toEqual([]);
  });

  it('PATCH /users/:id com roleId fora da empresa → 404', async () => {
    const created = await createUser('role404@somar.local', 'Role 404').expect(
      201,
    );

    await request(context.httpServer)
      .patch(`/users/${created.body.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ roleId: 'ffffffff-0000-0000-0000-000000000000' })
      .expect(404);
  });

  it('gestor (sem is_admin) não atribui cargo is_admin via PATCH → 403', async () => {
    const gestorToken = await seedGestorToken('gestor-role@somar.local');
    const created = await createUser(
      'alvo-role@somar.local',
      'Alvo Role',
    ).expect(201);

    await request(context.httpServer)
      .patch(`/users/${created.body.id}`)
      .set('Authorization', `Bearer ${gestorToken}`)
      .send({ roleId: USERS_SEEDED.ADMIN_ROLE_ID })
      .expect(403);
  });

  it('PATCH remove is_admin do último admin ativo → 409 (invariante)', async () => {
    await request(context.httpServer)
      .patch(`/users/${USERS_SEEDED.ADMIN_USER_ID}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ roleId: null })
      .expect(409);
  });

  it('PATCH e-mail para endereço de outra pessoa → 409', async () => {
    const a = await createUser('a@somar.local', 'A').expect(201);
    await createUser('b@somar.local', 'B').expect(201);

    await request(context.httpServer)
      .patch(`/users/${a.body.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ email: 'b@somar.local' })
      .expect(409);
  });

  it('PATCH isActive false desativa o vínculo e true reativa', async () => {
    const created = await createUser('toggle@somar.local', 'Toggle').expect(
      201,
    );

    const off = await request(context.httpServer)
      .patch(`/users/${created.body.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ isActive: false })
      .expect(200);
    expect(off.body.isActive).toBe(false);

    const on = await request(context.httpServer)
      .patch(`/users/${created.body.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ isActive: true })
      .expect(200);
    expect(on.body.isActive).toBe(true);
  });

  it('DELETE /users/:id exclui a participação (204) e a pessoa (última empresa)', async () => {
    const created = await createUser('deleto@somar.local', 'Deleto').expect(
      201,
    );

    await request(context.httpServer)
      .delete(`/users/${created.body.id}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(204);

    await request(context.httpServer)
      .get(`/users/${created.body.id}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(404);

    // Última empresa da pessoa + sem histórico → a pessoa é removida.
    const userRows = await context.dataSource.query(
      `SELECT COUNT(*)::int AS total FROM "user" WHERE "id" = $1`,
      [created.body.id],
    );
    expect(userRows[0].total).toBe(0);
  });

  it('DELETE remove só o vínculo quando a pessoa tem outra empresa', async () => {
    const created = await createUser('multi@somar.local', 'Multi').expect(201);

    // A pessoa passa a ter vínculo também na 2ª empresa.
    await context.dataSource.query(
      `INSERT INTO "company" ("id", "name", "is_active", "timezone")
       VALUES ($1, 'Autarquia B', true, 'America/Sao_Paulo')
       ON CONFLICT ("id") DO NOTHING`,
      [USERS_SEEDED.SECOND_COMPANY_ID],
    );
    await context.dataSource.query(
      `INSERT INTO "user_company" ("id", "user_id", "company_id", "type", "is_active")
       VALUES (gen_random_uuid(), $1, $2, 'EMPLOYEE', true)`,
      [created.body.id, USERS_SEEDED.SECOND_COMPANY_ID],
    );

    await request(context.httpServer)
      .delete(`/users/${created.body.id}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(204);

    // Pessoa permanece (tem outra empresa)...
    const userRows = await context.dataSource.query(
      `SELECT COUNT(*)::int AS total FROM "user" WHERE "id" = $1`,
      [created.body.id],
    );
    expect(userRows[0].total).toBe(1);

    // ...mas o vínculo da SOMAR foi removido.
    const linkRows = await context.dataSource.query(
      `SELECT COUNT(*)::int AS total FROM "user_company" WHERE "user_id" = $1 AND "company_id" = $2`,
      [created.body.id, USERS_SEEDED.SOMAR_COMPANY_ID],
    );
    expect(linkRows[0].total).toBe(0);
  });

  it('DELETE do último admin ativo → 409 (invariante)', async () => {
    await request(context.httpServer)
      .delete(`/users/${USERS_SEEDED.ADMIN_USER_ID}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(409);
  });

  it('gestor (MANAGE_USERS, sem is_admin) não edita usuário admin → 403', async () => {
    const gestorToken = await seedGestorToken('gestor@somar.local');

    await request(context.httpServer)
      .patch(`/users/${USERS_SEEDED.ADMIN_USER_ID}`)
      .set('Authorization', `Bearer ${gestorToken}`)
      .send({ name: 'Inválido' })
      .expect(403);
  });

  it('gestor pode editar um usuário comum (não admin)', async () => {
    const gestorToken = await seedGestorToken('gestor2@somar.local');
    const created = await createUser('comum@somar.local', 'Comum').expect(201);

    const res = await request(context.httpServer)
      .patch(`/users/${created.body.id}`)
      .set('Authorization', `Bearer ${gestorToken}`)
      .send({ name: 'Comum Editado' })
      .expect(200);

    expect(res.body).toMatchObject({ name: 'Comum Editado' });
  });
});
