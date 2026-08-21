// Supertest
import request from 'supertest';

// Support
import {
  createImportJobsIntegrationContext,
  IMPORTS_SEEDED,
  ImportJobsIntegrationContext,
} from './support/import-jobs-integration-context';

jest.setTimeout(120000);

describe('ImportJobs integration — consulta de jobs de importação (Testcontainers)', () => {
  let context: ImportJobsIntegrationContext;
  let token: string;

  beforeAll(async () => {
    context = await createImportJobsIntegrationContext();
    token = await context.loginAndGetToken(
      IMPORTS_SEEDED.ADMIN_EMAIL,
      IMPORTS_SEEDED.ADMIN_PASSWORD,
    );
  });

  afterAll(async () => {
    await context.close();
  });

  it('GET /import-jobs devolve lista paginada no formato padrão', async () => {
    const done = await context.seedImportJob({
      type: 'DEPARTMENT',
      status: 'DONE',
      fileName: 'departamentos.xlsx',
      totalRows: 3,
      processedRows: 3,
      successCount: 3,
      errorCount: 0,
    });
    const failed = await context.seedImportJob({
      type: 'VEHICLE',
      status: 'FAILED',
      fileName: 'veiculos.xlsx',
      totalRows: 5,
      processedRows: 0,
      successCount: 0,
      errorCount: 1,
      errorMessage: 'Linha 2: placa inválida.',
    });

    const res = await request(context.httpServer)
      .get('/import-jobs')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(res.body).toMatchObject({ limit: 20, offset: 0 });
    expect(typeof res.body.count).toBe('number');
    expect(Array.isArray(res.body.data)).toBe(true);

    const ids = res.body.data.map((job: { id: string }) => job.id);
    expect(ids).toContain(done.id);
    expect(ids).toContain(failed.id);

    const failedJob = res.body.data.find(
      (job: { id: string }) => job.id === failed.id,
    );
    expect(failedJob).toMatchObject({
      type: 'VEHICLE',
      status: 'FAILED',
      fileName: 'veiculos.xlsx',
      totalRows: 5,
      successCount: 0,
      errorCount: 1,
      errorMessage: 'Linha 2: placa inválida.',
    });
    expect(typeof failedJob.createdAt).toBe('string');
  });

  it('GET /import-jobs filtra por type', async () => {
    await context.seedImportJob({ type: 'USER', status: 'DONE' });
    await context.seedImportJob({ type: 'VEHICLE', status: 'DONE' });

    const res = await request(context.httpServer)
      .get('/import-jobs?type=VEHICLE')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(res.body.data.length).toBeGreaterThan(0);
    expect(
      res.body.data.every((job: { type: string }) => job.type === 'VEHICLE'),
    ).toBe(true);
  });

  it('GET /import-jobs com type inválido → 400', async () => {
    await request(context.httpServer)
      .get('/import-jobs?type=INVALIDO')
      .set('Authorization', `Bearer ${token}`)
      .expect(400);
  });

  it('GET /import-jobs/:jobId devolve o job (polling)', async () => {
    const job = await context.seedImportJob({
      type: 'DEPARTMENT',
      status: 'DONE',
      fileName: 'departamentos.xlsx',
      totalRows: 3,
      processedRows: 3,
      successCount: 3,
      errorCount: 0,
    });

    const res = await request(context.httpServer)
      .get(`/import-jobs/${job.id}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(res.body).toMatchObject({
      id: job.id,
      type: 'DEPARTMENT',
      status: 'DONE',
      fileName: 'departamentos.xlsx',
      totalRows: 3,
      successCount: 3,
    });
  });

  it('GET /import-jobs/:jobId com id inexistente → 404', async () => {
    await request(context.httpServer)
      .get('/import-jobs/50000000-0000-0000-0000-000000009999')
      .set('Authorization', `Bearer ${token}`)
      .expect(404);
  });

  it('GET /import-jobs sem token → 401', async () => {
    await request(context.httpServer).get('/import-jobs').expect(401);
  });

  it('GET /import-jobs com usuário sem MANAGE_IMPORTS → 403', async () => {
    await context.seedUserWithRole(
      'porteiro-imports@teste.local',
      IMPORTS_SEEDED.PORTEIRO_ROLE_ID,
    );
    const porteiroToken = await context.loginAndGetToken(
      'porteiro-imports@teste.local',
      IMPORTS_SEEDED.ADMIN_PASSWORD,
    );

    await request(context.httpServer)
      .get('/import-jobs')
      .set('Authorization', `Bearer ${porteiroToken}`)
      .expect(403);
  });
});
