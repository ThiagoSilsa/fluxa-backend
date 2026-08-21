// Supertest
import request from 'supertest';

// Fixtures
import { buildXlsxBufferFromRows } from '../../../../test/support/xlsx-fixture';

// Support
import { DATA_SHEET } from '../../../../shared/spreadsheet/read-spreadsheet.util';
import {
  createDepartmentsImportIntegrationContext,
  DEPARTMENTS_IMPORT_SEEDED,
  DepartmentsImportIntegrationContext,
} from './support/departments-import-integration-context';

jest.setTimeout(120000);

describe('Departments import integration — upload XLSX → worker → histórico (Testcontainers)', () => {
  let context: DepartmentsImportIntegrationContext;
  let token: string;

  beforeAll(async () => {
    context = await createDepartmentsImportIntegrationContext();
    token = await context.loginAndGetToken(
      DEPARTMENTS_IMPORT_SEEDED.ADMIN_EMAIL,
      DEPARTMENTS_IMPORT_SEEDED.ADMIN_PASSWORD,
    );
  });

  afterAll(async () => {
    await context.close();
  });

  it('POST /departments/import processa a planilha e insere os departamentos', async () => {
    const buffer = await buildXlsxBufferFromRows(DATA_SHEET, [
      ['name', 'parkingSpace', 'description'],
      ['Recepção', 10, 'Portaria principal'],
      ['Segurança', 5, ''],
    ]);

    const upload = await request(context.httpServer)
      .post('/departments/import')
      .set('Authorization', `Bearer ${token}`)
      .attach('file', buffer, 'departamentos.xlsx')
      .expect(201);

    expect(upload.body).toMatchObject({ status: 'PENDING' });
    expect(typeof upload.body.jobId).toBe('string');

    const job = await context.pollJobUntilFinished(upload.body.jobId, token);

    expect(job.status).toBe('DONE');
    expect(job.successCount).toBe(2);
    expect(job.errorCount).toBe(0);

    const res = await request(context.httpServer)
      .get('/departments')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    const names = res.body.data.map((d: { name: string }) => d.name);
    expect(names).toEqual(expect.arrayContaining(['Recepção', 'Segurança']));
  });

  it('POST /departments/import com linha inválida → job FAILED e nada inserido', async () => {
    const buffer = await buildXlsxBufferFromRows(DATA_SHEET, [
      ['name', 'parkingSpace'],
      ['Válido', 5],
      ['X', 1], // name muito curto — linha 3
    ]);

    const upload = await request(context.httpServer)
      .post('/departments/import')
      .set('Authorization', `Bearer ${token}`)
      .attach('file', buffer, 'invalidos.xlsx')
      .expect(201);

    const job = await context.pollJobUntilFinished(upload.body.jobId, token);

    expect(job.status).toBe('FAILED');
    expect(job.errorMessage).toContain('Linha 3');
    expect(job.errorCount).toBe(1);

    // Fail-fast: nada foi inserido
    const res = await request(context.httpServer)
      .get('/departments?search=Válido')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(res.body.count).toBe(0);
  });

  it('POST /departments/import com arquivo não .xlsx → 400', async () => {
    await request(context.httpServer)
      .post('/departments/import')
      .set('Authorization', `Bearer ${token}`)
      .attach('file', Buffer.from('a,b\n1,2'), 'dados.csv')
      .expect(400);
  });

  it('POST /departments/import sem token → 401', async () => {
    const buffer = await buildXlsxBufferFromRows(DATA_SHEET, [
      ['name', 'parkingSpace'],
      ['Sem Token', 1],
    ]);

    await request(context.httpServer)
      .post('/departments/import')
      .attach('file', buffer, 'sem-token.xlsx')
      .expect(401);
  });

  it('POST /departments/import com usuário sem MANAGE_IMPORTS → 403', async () => {
    await context.seedUserWithRole(
      'porteiro-import@teste.local',
      DEPARTMENTS_IMPORT_SEEDED.PORTEIRO_ROLE_ID,
    );
    const porteiroToken = await context.loginAndGetToken(
      'porteiro-import@teste.local',
      DEPARTMENTS_IMPORT_SEEDED.ADMIN_PASSWORD,
    );

    const buffer = await buildXlsxBufferFromRows(DATA_SHEET, [
      ['name', 'parkingSpace'],
      ['Porteiro', 1],
    ]);

    await request(context.httpServer)
      .post('/departments/import')
      .set('Authorization', `Bearer ${porteiroToken}`)
      .attach('file', buffer, 'porteiro.xlsx')
      .expect(403);
  });
});
