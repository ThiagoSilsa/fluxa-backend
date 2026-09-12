// Supertest
import request from 'supertest';

// Support
import {
  ACCESS_SEEDED,
  AccessIntegrationContext,
  createAccessIntegrationContext,
} from './support/access-integration-context';

jest.setTimeout(120000);

describe('Access integration — entrada com solicitação (Modelo B, ADR 0014 §1/§5)', () => {
  let context: AccessIntegrationContext;
  let adminToken: string;
  let porteiroToken: string;
  /** Departamento com 1 vaga (cenário de rollback). */
  let singleSlotDepartmentId: string;

  /** Lê a solicitação da placa (ou `null`). */
  const findRequest = async (
    plate: string,
  ): Promise<{ id: string; status: string; requested_at: Date } | null> => {
    const rows = await context.dataSource.query(
      `SELECT "id", "status", "requested_at" FROM "access_request" WHERE "plate" = $1 ORDER BY "requested_at" DESC LIMIT 1`,
      [plate],
    );
    return rows[0] ?? null;
  };

  /** `access_request_id` do último acesso da placa. */
  const accessRequestIdOf = async (plate: string): Promise<string | null> => {
    const rows = await context.dataSource.query(
      `SELECT va."access_request_id"
         FROM "vehicle_access" va
         LEFT JOIN "vehicle" v ON v."id" = va."vehicle_id"
        WHERE (v."plate" = $1 OR va."temporary_plate" = $1)
        ORDER BY va."created_at" DESC
        LIMIT 1`,
      [plate],
    );
    return rows[0]?.access_request_id ?? null;
  };

  beforeAll(async () => {
    context = await createAccessIntegrationContext();
    adminToken = await context.loginAndGetToken(
      ACCESS_SEEDED.ADMIN_EMAIL,
      ACCESS_SEEDED.ADMIN_PASSWORD,
    );
    await context.seedUserWithRole(
      'porteiro.modelob@teste.local',
      ACCESS_SEEDED.PORTEIRO_ROLE_ID,
    );
    porteiroToken = await context.loginAndGetToken(
      'porteiro.modelob@teste.local',
      ACCESS_SEEDED.ADMIN_PASSWORD,
    );

    // Veículo free_pass (contrato aditivo: entrada sem solicitação segue igual).
    await request(context.httpServer)
      .post('/vehicles')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        plate: 'FRE9A23',
        vehicleTypeId: ACCESS_SEEDED.FROTA_TYPE_ID,
        freePass: true,
      })
      .expect(201);

    // Departamento com 1 vaga + departamento geral (capacidade folgada).
    const singleSlot = await request(context.httpServer)
      .post('/departments')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Vaga Única Modelo B', parkingSpace: 1 })
      .expect(201);
    singleSlotDepartmentId = singleSlot.body.id;
    await request(context.httpServer)
      .post('/departments')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Geral Modelo B', parkingSpace: 100 })
      .expect(201);
  });

  afterAll(async () => {
    await context.close();
  });

  it('contrato aditivo: entrada de placa cadastrada sem solicitação continua igual', async () => {
    const res = await request(context.httpServer)
      .post('/access/entry')
      .set('Authorization', `Bearer ${porteiroToken}`)
      .send({ plate: 'FRE9A23' })
      .expect(201);

    expect(res.body.granted).toBe(true);
    expect(res.body.access.accessRequestId).toBeNull();
  });

  it('cria a solicitação e a entrada na mesma operação (bloco request)', async () => {
    const res = await request(context.httpServer)
      .post('/access/entry')
      .set('Authorization', `Bearer ${porteiroToken}`)
      .send({
        plate: 'REQ1A23',
        request: {
          type: 'BOTH',
          contactPhone: '11999990001',
          payload: {
            driver: { name: 'Motorista Novo' },
            vehicle: { model: 'Fiorino', color: 'Branca' },
          },
        },
      })
      .expect(201);

    expect(res.body.granted).toBe(true);
    expect(res.body.message).toBe('Entrada registrada com solicitação.');

    const created = await findRequest('REQ1A23');
    expect(created).toMatchObject({ status: 'PENDING' });
    expect(res.body.access).toMatchObject({
      accessRequestId: created?.id,
      vehicleId: null,
      temporaryPlate: 'REQ1A23',
      temporaryDriverName: 'Motorista Novo',
    });
    expect(await accessRequestIdOf('REQ1A23')).toBe(created?.id);
  });

  it('libera com a solicitação aberta existente (accessRequestId — Modelo B)', async () => {
    const created = await request(context.httpServer)
      .post('/access-requests')
      .set('Authorization', `Bearer ${porteiroToken}`)
      .send({
        type: 'BOTH',
        plate: 'REQ2A23',
        contactPhone: '11999990002',
        payload: {
          driver: { name: 'Motorista Existente' },
          vehicle: { model: 'Uno', color: 'Prata' },
        },
      })
      .expect(201);

    const res = await request(context.httpServer)
      .post('/access/entry')
      .set('Authorization', `Bearer ${porteiroToken}`)
      .send({ plate: 'REQ2A23', accessRequestId: created.body.id })
      .expect(201);

    expect(res.body.granted).toBe(true);
    expect(res.body.access).toMatchObject({
      accessRequestId: created.body.id,
      temporaryDriverName: 'Motorista Existente',
    });
  });

  it('nega por prazo vencido e registra o impedimento OVERDUE', async () => {
    const created = await request(context.httpServer)
      .post('/access-requests')
      .set('Authorization', `Bearer ${porteiroToken}`)
      .send({
        type: 'BOTH',
        plate: 'REQ3A23',
        contactPhone: '11999990003',
        payload: {
          driver: { name: 'Motorista Antigo' },
          vehicle: { model: 'Gol', color: 'Preto' },
        },
      })
      .expect(201);

    await context.dataSource.query(
      `UPDATE "access_request" SET "requested_at" = now() - interval '5 days' WHERE "id" = $1`,
      [created.body.id],
    );

    const res = await request(context.httpServer)
      .post('/access/entry')
      .set('Authorization', `Bearer ${porteiroToken}`)
      .send({ plate: 'REQ3A23', accessRequestId: created.body.id })
      .expect(201);

    expect(res.body.granted).toBe(false);
    expect(res.body.denial).toMatchObject({
      reason: 'OVERDUE',
      plateSnapshot: 'REQ3A23',
    });
    expect(await context.countDenialsByPlate('REQ3A23')).toBe(1);
    expect(await context.countInsideByPlate('REQ3A23')).toBe(0);
  });

  it('a pré-autorização (entry_authorized) sobrepõe o prazo vencido', async () => {
    const created = await request(context.httpServer)
      .post('/access-requests')
      .set('Authorization', `Bearer ${porteiroToken}`)
      .send({
        type: 'BOTH',
        plate: 'REQ5A23',
        contactPhone: '11999990005',
        payload: {
          driver: { name: 'Motorista Autorizado' },
          vehicle: { model: 'Strada', color: 'Branca' },
        },
      })
      .expect(201);

    await context.dataSource.query(
      `UPDATE "access_request"
          SET "requested_at" = now() - interval '5 days', "entry_authorized" = true
        WHERE "id" = $1`,
      [created.body.id],
    );

    const res = await request(context.httpServer)
      .post('/access/entry')
      .set('Authorization', `Bearer ${porteiroToken}`)
      .send({ plate: 'REQ5A23', accessRequestId: created.body.id })
      .expect(201);

    expect(res.body.granted).toBe(true);
  });

  it('rejeita solicitação de outra placa (400)', async () => {
    const created = await request(context.httpServer)
      .post('/access-requests')
      .set('Authorization', `Bearer ${porteiroToken}`)
      .send({
        type: 'BOTH',
        plate: 'REQ6A23',
        contactPhone: '11999990006',
        payload: {
          driver: { name: 'Motorista Seis' },
          vehicle: { model: 'HB20', color: 'Azul' },
        },
      })
      .expect(201);

    await request(context.httpServer)
      .post('/access/entry')
      .set('Authorization', `Bearer ${porteiroToken}`)
      .send({ plate: 'REQ7A23', accessRequestId: created.body.id })
      .expect(400);
  });

  it('rejeita solicitação existente junto com a nova (400)', async () => {
    await request(context.httpServer)
      .post('/access/entry')
      .set('Authorization', `Bearer ${porteiroToken}`)
      .send({
        plate: 'REQ8A23',
        accessRequestId: '50000000-0000-0000-0000-000000000099',
        request: {
          type: 'BOTH',
          contactPhone: '11999990008',
          payload: {
            driver: { name: 'Motorista Oito' },
            vehicle: { model: 'Kwid', color: 'Cinza' },
          },
        },
      })
      .expect(400);
  });

  it('não deixa solicitação órfã quando a vaga está cheia (409)', async () => {
    // Ocupa a única vaga do setor com uma entrada real (free_pass).
    await request(context.httpServer)
      .post('/access/entry')
      .set('Authorization', `Bearer ${porteiroToken}`)
      .send({ plate: 'FRE9A23', departmentId: singleSlotDepartmentId })
      .expect(201);

    await request(context.httpServer)
      .post('/access/entry')
      .set('Authorization', `Bearer ${porteiroToken}`)
      .send({
        plate: 'CAP9A23',
        departmentId: singleSlotDepartmentId,
        request: {
          type: 'BOTH',
          contactPhone: '11999990009',
          payload: {
            driver: { name: 'Motorista Nove' },
            vehicle: { model: 'Mobi', color: 'Vermelha' },
          },
        },
      })
      .expect(409);

    expect(await findRequest('CAP9A23')).toBeNull();
  });
});
