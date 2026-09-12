// Supertest
import request from 'supertest';

// Support
import {
  ACCESS_REQUESTS_SEEDED,
  AccessRequestsIntegrationContext,
  createAccessRequestsIntegrationContext,
} from './support/access-requests-integration-context';

jest.setTimeout(120000);

/**
 * Endpoints de seleção de baixo privilégio (ADR 0011) — `/vehicles/options` e
 * `/users/options`, acessíveis a quem cria solicitação de acesso OU de
 * bloqueio (`CREATE_ACCESS_REQUEST`/`CREATE_BLOCK_REQUEST`), sem exigir
 * permissões de gerenciamento.
 *
 * Reusa o contexto de `access-requests` (AppModule completo + seeds 0001/0002
 * + cargo Porteiro com `CREATE_ACCESS_REQUEST`).
 */
describe('Options de seleção para solicitantes — ADR 0011', () => {
  let context: AccessRequestsIntegrationContext;
  let adminToken: string;
  let porteiroToken: string;
  let semPermissaoToken: string;

  beforeAll(async () => {
    context = await createAccessRequestsIntegrationContext();
    adminToken = await context.loginAndGetToken(
      ACCESS_REQUESTS_SEEDED.ADMIN_EMAIL,
      ACCESS_REQUESTS_SEEDED.ADMIN_PASSWORD,
    );

    // Porteiro (CREATE_ACCESS_REQUEST) — busca permitida.
    await context.seedUserWithRole(
      'porteiro.options@teste.local',
      ACCESS_REQUESTS_SEEDED.PORTEIRO_ROLE_ID,
    );
    porteiroToken = await context.loginAndGetToken(
      'porteiro.options@teste.local',
      ACCESS_REQUESTS_SEEDED.ADMIN_PASSWORD,
    );

    // Usuário autenticado sem cargo (sem permissões de solicitação/gestão).
    await seedUserWithoutRole(context, 'semdireitos@teste.local');
    semPermissaoToken = await context.loginAndGetToken(
      'semdireitos@teste.local',
      ACCESS_REQUESTS_SEEDED.ADMIN_PASSWORD,
    );

    // Veículo da empresa para o porteiro encontrar por placa/modelo.
    await request(context.httpServer)
      .post('/vehicles')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        plate: 'ABC1D23',
        vehicleTypeId: ACCESS_REQUESTS_SEEDED.FROTA_TYPE_ID,
        model: 'Onix',
      })
      .expect(201);

    // Pessoa com telefone e documento mascarados (busca tolerante — regra 41).
    await request(context.httpServer)
      .post('/users')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: 'Marina Buscavel',
        email: 'marina.buscavel@teste.local',
        password: 'senha123456',
        type: 'EMPLOYEE',
        roleId: ACCESS_REQUESTS_SEEDED.PORTEIRO_ROLE_ID,
        phone: '(11) 98888-7777',
        document: '123.456.789-00',
      })
      .expect(201);
  });

  beforeEach(() => {
    context.resetThrottle();
  });

  afterAll(async () => {
    await context.close();
  });

  describe('GET /vehicles/options', () => {
    it('porteiro busca veículo por placa (resposta enxuta { id, plate, model })', async () => {
      const res = await request(context.httpServer)
        .get('/vehicles/options?search=ABC1&limit=10&offset=0')
        .set('Authorization', `Bearer ${porteiroToken}`)
        .expect(200);

      expect(res.body).toMatchObject({ limit: 10, offset: 0 });
      expect(res.body.count).toBeGreaterThanOrEqual(1);
      expect(res.body.data).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ plate: 'ABC1D23', model: 'Onix' }),
        ]),
      );
      for (const item of res.body.data) {
        expect(Object.keys(item).sort()).toEqual(['id', 'model', 'plate']);
      }
    });

    it('porteiro busca veículo por modelo', async () => {
      const res = await request(context.httpServer)
        .get('/vehicles/options?search=Onix')
        .set('Authorization', `Bearer ${porteiroToken}`)
        .expect(200);

      expect(
        res.body.data.some(
          (vehicle: { plate: string }) => vehicle.plate === 'ABC1D23',
        ),
      ).toBe(true);
    });

    it('sem resultado devolve página vazia', async () => {
      const res = await request(context.httpServer)
        .get('/vehicles/options?search=ZZZ0')
        .set('Authorization', `Bearer ${porteiroToken}`)
        .expect(200);

      expect(res.body.data).toEqual([]);
      expect(res.body.count).toBe(0);
    });

    it('devolve 401 sem token', async () => {
      await request(context.httpServer).get('/vehicles/options').expect(401);
    });

    it('devolve 403 para usuário sem permissão de solicitação', async () => {
      await request(context.httpServer)
        .get('/vehicles/options')
        .set('Authorization', `Bearer ${semPermissaoToken}`)
        .expect(403);
    });
  });

  describe('GET /users/options', () => {
    it('porteiro busca usuário ativo por e-mail (resposta enxuta { id, name, email })', async () => {
      const res = await request(context.httpServer)
        .get('/users/options?search=porteiro.options')
        .set('Authorization', `Bearer ${porteiroToken}`)
        .expect(200);

      expect(res.body.data).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            email: 'porteiro.options@teste.local',
            name: 'Usuário de teste',
          }),
        ]),
      );
      for (const item of res.body.data) {
        expect(Object.keys(item).sort()).toEqual(['email', 'id', 'name']);
      }
    });

    it('devolve 401 sem token', async () => {
      await request(context.httpServer).get('/users/options').expect(401);
    });

    it('devolve 403 para usuário sem permissão de solicitação', async () => {
      await request(context.httpServer)
        .get('/users/options')
        .set('Authorization', `Bearer ${semPermissaoToken}`)
        .expect(403);
    });
  });

  describe('Busca de pessoas por nome, telefone e documento (regra 41)', () => {
    /** Busca em `/users/options` e devolve os nomes encontrados. */
    const searchNames = async (term: string): Promise<string[]> => {
      const res = await request(context.httpServer)
        .get(`/users/options?search=${encodeURIComponent(term)}`)
        .set('Authorization', `Bearer ${porteiroToken}`)
        .expect(200);
      return res.body.data.map((item: { name: string }) => item.name);
    };

    it('encontra por trecho do nome', async () => {
      await expect(searchNames('Marina')).resolves.toContain('Marina Buscavel');
    });

    it('encontra por telefone sem máscara', async () => {
      await expect(searchNames('988887777')).resolves.toContain(
        'Marina Buscavel',
      );
    });

    it('encontra por telefone com máscara', async () => {
      await expect(searchNames('(11) 98888-7777')).resolves.toContain(
        'Marina Buscavel',
      );
    });

    it('encontra por documento sem máscara', async () => {
      await expect(searchNames('12345678900')).resolves.toContain(
        'Marina Buscavel',
      );
    });

    it('encontra por documento com máscara', async () => {
      await expect(searchNames('123.456.789-00')).resolves.toContain(
        'Marina Buscavel',
      );
    });

    it('termo sem resultado devolve página vazia (não a empresa inteira)', async () => {
      await expect(searchNames('zzzznada')).resolves.toEqual([]);
    });

    it('a mesma busca vale para /vehicles/driver-candidates (gestão)', async () => {
      const res = await request(context.httpServer)
        .get('/vehicles/driver-candidates?search=988887777')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(
        res.body.data.some(
          (candidate: { name: string }) => candidate.name === 'Marina Buscavel',
        ),
      ).toBe(true);
    });
  });
});

/**
 * Cria um usuário ativo na SOMAR **sem cargo** (sem permissões) — para o
 * cenário de 403 nos endpoints de seleção.
 *
 * @param context Contexto de integração.
 * @param email E-mail do novo usuário.
 */
async function seedUserWithoutRole(
  context: AccessRequestsIntegrationContext,
  email: string,
): Promise<void> {
  const rows = await context.dataSource.query(
    `INSERT INTO "user" ("id", "name", "email", "password")
     SELECT gen_random_uuid(), $1, $2, "password"
     FROM "user" WHERE "email" = $3
     RETURNING "id"`,
    ['Usuário sem permissões', email, ACCESS_REQUESTS_SEEDED.ADMIN_EMAIL],
  );
  const userId = rows[0]?.id;
  if (!userId) {
    throw new Error('Falha ao criar usuário de teste.');
  }

  await context.dataSource.query(
    `INSERT INTO "user_company" ("id", "user_id", "company_id", "type", "is_active")
     VALUES (gen_random_uuid(), $1, $2, 'EMPLOYEE', true)
     ON CONFLICT ("user_id", "company_id") DO NOTHING`,
    [userId, ACCESS_REQUESTS_SEEDED.SOMAR_COMPANY_ID],
  );
}
