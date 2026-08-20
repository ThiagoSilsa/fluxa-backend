// Supertest
import request from 'supertest';

// Fixtures
import { buildXlsxBufferFromRows } from '../../../../test/support/xlsx-fixture';

// Support
import { DATA_SHEET } from '../../../../shared/spreadsheet/read-spreadsheet.util';
import {
  createVehiclesImportIntegrationContext,
  VEHICLES_IMPORT_SEEDED,
  VehiclesImportIntegrationContext,
} from './support/vehicles-import-integration-context';

jest.setTimeout(120000);

describe('Vehicles import integration — veículos e vínculo usuário-veículo (Testcontainers)', () => {
  let context: VehiclesImportIntegrationContext;
  let token: string;

  beforeAll(async () => {
    context = await createVehiclesImportIntegrationContext();
    token = await context.loginAndGetToken(
      VEHICLES_IMPORT_SEEDED.ADMIN_EMAIL,
      VEHICLES_IMPORT_SEEDED.ADMIN_PASSWORD,
    );
  });

  afterAll(async () => {
    await context.close();
  });

  it('POST /vehicles/import insere os veículos (tipo FROTA do seed)', async () => {
    const buffer = await buildXlsxBufferFromRows(DATA_SHEET, [
      ['plate', 'vehicleType', 'model', 'color'],
      ['ABC1234', 'FROTA', 'Gol', 'Preto'],
      ['ABC1D23', 'PARTICULAR', '', ''],
    ]);

    const upload = await request(context.httpServer)
      .post('/vehicles/import')
      .set('Authorization', `Bearer ${token}`)
      .attach('file', buffer, 'veiculos.xlsx')
      .expect(201);

    const job = await context.pollJobUntilFinished(upload.body.jobId, token);
    expect(job.status).toBe('DONE');
    expect(job.successCount).toBe(2);

    const res = await request(context.httpServer)
      .get('/vehicles?sortBy=plate&sortOrder=ASC')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    const plates = res.body.data.map((v: { plate: string }) => v.plate);
    expect(plates).toEqual(expect.arrayContaining(['ABC1234', 'ABC1D23']));
  });

  it('POST /vehicles/import define o departamento padrão quando informado', async () => {
    const department = await request(context.httpServer)
      .post('/departments')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Recepção', parkingSpace: 10 })
      .expect(201);

    const buffer = await buildXlsxBufferFromRows(DATA_SHEET, [
      ['plate', 'vehicleType', 'department'],
      ['XYZ1234', 'FROTA', 'Recepção'],
    ]);

    const upload = await request(context.httpServer)
      .post('/vehicles/import')
      .set('Authorization', `Bearer ${token}`)
      .attach('file', buffer, 'com-departamento.xlsx')
      .expect(201);

    const job = await context.pollJobUntilFinished(upload.body.jobId, token);
    expect(job.status).toBe('DONE');

    const vehicle = await request(context.httpServer)
      .get('/vehicles?search=XYZ1234')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    const vehicleId = vehicle.body.data[0].id;

    const detail = await request(context.httpServer)
      .get(`/vehicles/${vehicleId}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(detail.body.department).toEqual({
      id: department.body.id,
      name: 'Recepção',
    });
  });

  it('POST /vehicles/import com freePass=true (admin tem bypass) → DONE', async () => {
    const buffer = await buildXlsxBufferFromRows(DATA_SHEET, [
      ['plate', 'vehicleType', 'freePass'],
      ['MNO1234', 'PARTICULAR', 'true'],
    ]);

    const upload = await request(context.httpServer)
      .post('/vehicles/import')
      .set('Authorization', `Bearer ${token}`)
      .attach('file', buffer, 'livre.xlsx')
      .expect(201);

    const job = await context.pollJobUntilFinished(upload.body.jobId, token);
    expect(job.status).toBe('DONE');

    const res = await request(context.httpServer)
      .get('/vehicles?search=MNO1234')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(res.body.data[0].freePass).toBe(true);
  });

  it('POST /vehicles/import com linha inválida → FAILED e nada inserido', async () => {
    const buffer = await buildXlsxBufferFromRows(DATA_SHEET, [
      ['plate', 'vehicleType'],
      ['JKL1234', 'FROTA'],
      ['RUIM', 'FROTA'], // placa inválida — linha 3
    ]);

    const upload = await request(context.httpServer)
      .post('/vehicles/import')
      .set('Authorization', `Bearer ${token}`)
      .attach('file', buffer, 'invalidos.xlsx')
      .expect(201);

    const job = await context.pollJobUntilFinished(upload.body.jobId, token);
    expect(job.status).toBe('FAILED');
    expect(job.errorMessage).toContain('Linha 3');

    const res = await request(context.httpServer)
      .get('/vehicles?search=JKL1234')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(res.body.count).toBe(0);
  });

  it('POST /user-vehicles/import vincula motorista a veículo (por placa e e-mail)', async () => {
    await context.seedUserWithRole(
      'motorista-import@teste.local',
      VEHICLES_IMPORT_SEEDED.PORTEIRO_ROLE_ID,
    );

    const vehicle = await request(context.httpServer)
      .post('/vehicles')
      .set('Authorization', `Bearer ${token}`)
      .send({
        plate: 'GHI1234',
        vehicleTypeId: '40000000-0000-0000-0000-000000000001',
      })
      .expect(201);

    const buffer = await buildXlsxBufferFromRows(DATA_SHEET, [
      ['vehiclePlate', 'userEmail', 'isPrimary', 'canDrive'],
      ['GHI1234', 'motorista-import@teste.local', 'true', 'true'],
    ]);

    const upload = await request(context.httpServer)
      .post('/user-vehicles/import')
      .set('Authorization', `Bearer ${token}`)
      .attach('file', buffer, 'vinculos.xlsx')
      .expect(201);

    const job = await context.pollJobUntilFinished(upload.body.jobId, token);
    expect(job.status).toBe('DONE');
    expect(job.successCount).toBe(1);

    const drivers = await request(context.httpServer)
      .get(`/vehicles/${vehicle.body.id}/drivers`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(drivers.body.drivers).toEqual([
      expect.objectContaining({
        isPrimary: true,
        canDrive: true,
        user: expect.objectContaining({ name: 'Usuário de teste' }),
      }),
    ]);
  });

  it('POST /user-vehicles/import com e-mail desconhecido → FAILED', async () => {
    const buffer = await buildXlsxBufferFromRows(DATA_SHEET, [
      ['vehiclePlate', 'userEmail'],
      ['GHI1234', 'ninguem@teste.local'],
    ]);

    const upload = await request(context.httpServer)
      .post('/user-vehicles/import')
      .set('Authorization', `Bearer ${token}`)
      .attach('file', buffer, 'sem-usuario.xlsx')
      .expect(201);

    const job = await context.pollJobUntilFinished(upload.body.jobId, token);
    expect(job.status).toBe('FAILED');
    expect(job.errorMessage).toContain('Linha 2');
  });

  it('POST /vehicles/import com usuário sem MANAGE_IMPORTS → 403', async () => {
    await context.seedUserWithRole(
      'porteiro-vehicles@teste.local',
      VEHICLES_IMPORT_SEEDED.PORTEIRO_ROLE_ID,
    );
    const porteiroToken = await context.loginAndGetToken(
      'porteiro-vehicles@teste.local',
      VEHICLES_IMPORT_SEEDED.ADMIN_PASSWORD,
    );

    const buffer = await buildXlsxBufferFromRows(DATA_SHEET, [
      ['plate', 'vehicleType'],
      ['ABC1234', 'FROTA'],
    ]);

    await request(context.httpServer)
      .post('/vehicles/import')
      .set('Authorization', `Bearer ${porteiroToken}`)
      .attach('file', buffer, 'porteiro.xlsx')
      .expect(403);
  });
});
