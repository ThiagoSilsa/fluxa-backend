// Supertest
import request from 'supertest';

// Fixtures
import { buildXlsxBufferFromRows } from '../../../../test/support/xlsx-fixture';

// Support
import { DATA_SHEET } from '../../../../shared/spreadsheet/read-spreadsheet.util';
import {
  createUsersImportIntegrationContext,
  USERS_IMPORT_SEEDED,
  UsersImportIntegrationContext,
} from './support/users-import-integration-context';

jest.setTimeout(120000);

describe('Users import integration — importação de usuários (Testcontainers)', () => {
  let context: UsersImportIntegrationContext;
  let token: string;

  beforeAll(async () => {
    context = await createUsersImportIntegrationContext();
    token = await context.loginAndGetToken(
      USERS_IMPORT_SEEDED.ADMIN_EMAIL,
      USERS_IMPORT_SEEDED.ADMIN_PASSWORD,
    );
  });

  afterAll(async () => {
    await context.close();
  });

  it('POST /users/import cria usuários (com cargo e senha default) e permite login', async () => {
    const buffer = await buildXlsxBufferFromRows(DATA_SHEET, [
      ['email', 'name', 'type', 'password', 'role'],
      ['joao-import@teste.local', 'João Importado', 'EMPLOYEE', '', 'Porteiro'],
      ['maria-import@teste.local', 'Maria Importada', 'VISITOR', '', ''],
    ]);

    const upload = await request(context.httpServer)
      .post('/users/import')
      .set('Authorization', `Bearer ${token}`)
      .attach('file', buffer, 'usuarios.xlsx')
      .expect(201);

    expect(upload.body).toMatchObject({ status: 'PENDING' });

    const job = await context.pollJobUntilFinished(upload.body.jobId, token);
    expect(job.status).toBe('DONE');
    expect(job.successCount).toBe(2);

    const res = await request(context.httpServer)
      .get('/users?search=joao-import@teste.local')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(res.body.count).toBe(1);
    expect(res.body.data[0]).toMatchObject({
      email: 'joao-import@teste.local',
      name: 'João Importado',
    });

    // Senha default de onboarding permite login
    const login = await request(context.httpServer).post('/auth/login').send({
      email: 'joao-import@teste.local',
      password: USERS_IMPORT_SEEDED.DEFAULT_PASSWORD,
    });
    expect(login.status).toBe(200);
  });

  it('POST /users/import com e-mail já vinculado → FAILED', async () => {
    const buffer = await buildXlsxBufferFromRows(DATA_SHEET, [
      ['email', 'name'],
      [USERS_IMPORT_SEEDED.ADMIN_EMAIL, 'Admin Duplicado'],
    ]);

    const upload = await request(context.httpServer)
      .post('/users/import')
      .set('Authorization', `Bearer ${token}`)
      .attach('file', buffer, 'duplicado.xlsx')
      .expect(201);

    const job = await context.pollJobUntilFinished(upload.body.jobId, token);
    expect(job.status).toBe('FAILED');
    expect(job.errorMessage).toContain('já está vinculado');
  });

  it('POST /users/import com linha inválida (name curto) → FAILED e nada inserido', async () => {
    const buffer = await buildXlsxBufferFromRows(DATA_SHEET, [
      ['email', 'name'],
      ['valido-import@teste.local', 'Válido'],
      ['curto-import@teste.local', 'X'],
    ]);

    const upload = await request(context.httpServer)
      .post('/users/import')
      .set('Authorization', `Bearer ${token}`)
      .attach('file', buffer, 'invalidos.xlsx')
      .expect(201);

    const job = await context.pollJobUntilFinished(upload.body.jobId, token);
    expect(job.status).toBe('FAILED');
    expect(job.errorMessage).toContain('Linha 3');

    const res = await request(context.httpServer)
      .get('/users?search=valido-import@teste.local')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(res.body.count).toBe(0);
  });

  it('POST /users/import com arquivo não .xlsx → 400', async () => {
    await request(context.httpServer)
      .post('/users/import')
      .set('Authorization', `Bearer ${token}`)
      .attach('file', Buffer.from('a,b\n1,2'), 'usuarios.csv')
      .expect(400);
  });

  it('POST /users/import sem token → 401', async () => {
    const buffer = await buildXlsxBufferFromRows(DATA_SHEET, [
      ['email', 'name'],
      ['sem-token@teste.local', 'Sem Token'],
    ]);

    await request(context.httpServer)
      .post('/users/import')
      .attach('file', buffer, 'sem-token.xlsx')
      .expect(401);
  });
});
