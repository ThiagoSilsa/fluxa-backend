// Supertest
import request from 'supertest';

// Support
import {
  ACCESS_SEEDED,
  AccessIntegrationContext,
  createAccessIntegrationContext,
} from './support/access-integration-context';

jest.setTimeout(120000);

describe('Access integration — GET /access/records (feed da portaria, ADR 0015)', () => {
  let context: AccessIntegrationContext;
  let adminToken: string;
  let porteiroToken: string;
  let presidenteToken: string;
  let entranceId: string;
  /** Placa com ENTRY + EXIT. */
  const vehiclePlate = 'REC1A23';
  /** Placa do impedimento. */
  const denialPlate = 'REC2A23';

  beforeAll(async () => {
    context = await createAccessIntegrationContext();
    adminToken = await context.loginAndGetToken(
      ACCESS_SEEDED.ADMIN_EMAIL,
      ACCESS_SEEDED.ADMIN_PASSWORD,
    );
    await context.seedUserWithRole(
      'porteiro.feed@teste.local',
      ACCESS_SEEDED.PORTEIRO_ROLE_ID,
    );
    porteiroToken = await context.loginAndGetToken(
      'porteiro.feed@teste.local',
      ACCESS_SEEDED.ADMIN_PASSWORD,
    );
    // Presidência — sem REGISTER_ENTRY/EXIT/DENIAL (cenário de 403).
    await context.seedUserWithRole(
      'presidente.feed@teste.local',
      '20000000-0000-0000-0000-000000000003',
    );
    presidenteToken = await context.loginAndGetToken(
      'presidente.feed@teste.local',
      ACCESS_SEEDED.ADMIN_PASSWORD,
    );

    // Portaria e departamento (nomes resolvidos no feed).
    const entranceRes = await request(context.httpServer)
      .post('/entrances')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Portaria do Feed' })
      .expect(201);
    entranceId = entranceRes.body.id;

    const departmentRes = await request(context.httpServer)
      .post('/departments')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Setor do Feed', parkingSpace: 50 })
      .expect(201);
    const departmentId = departmentRes.body.id;

    // Veículo free_pass (entrada sem condutor).
    await request(context.httpServer)
      .post('/vehicles')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        plate: vehiclePlate,
        model: 'Onix',
        vehicleTypeId: ACCESS_SEEDED.FROTA_TYPE_ID,
        freePass: true,
      })
      .expect(201);

    // Entrada e saída (movimentos ENTRY/EXIT) com portaria e departamento.
    await request(context.httpServer)
      .post('/access/entry')
      .set('Authorization', `Bearer ${porteiroToken}`)
      .send({ plate: vehiclePlate, departmentId, entranceId })
      .expect(201);
    await request(context.httpServer)
      .post('/access/exit')
      .set('Authorization', `Bearer ${porteiroToken}`)
      .send({ plate: vehiclePlate, entranceId })
      .expect(201);

    // Impedimento (ledger `entry_denial`) na mesma portaria.
    await request(context.httpServer)
      .post('/entry-denials')
      .set('Authorization', `Bearer ${porteiroToken}`)
      .send({
        plate: denialPlate,
        reason: 'UNREGISTERED',
        observation: 'Placa desconhecida no feed',
        entranceId,
      })
      .expect(201);
  });

  afterAll(async () => {
    await context.close();
  });

  it('nega acesso sem REGISTER_ENTRY/EXIT/DENIAL (403)', async () => {
    await request(context.httpServer)
      .get('/access/records')
      .set('Authorization', `Bearer ${presidenteToken}`)
      .expect(403);
  });

  it('rejeita tipo de registro inválido (400)', async () => {
    await request(context.httpServer)
      .get('/access/records?kind=INVALIDO')
      .set('Authorization', `Bearer ${porteiroToken}`)
      .expect(400);
  });

  it('une os dois ledgers em uma linha do tempo, mais recente primeiro', async () => {
    const res = await request(context.httpServer)
      .get('/access/records?limit=100')
      .set('Authorization', `Bearer ${porteiroToken}`)
      .expect(200);

    expect(res.body).toMatchObject({ limit: 100, offset: 0 });
    const kinds = res.body.data.map((record: { kind: string }) => record.kind);
    expect(kinds).toEqual(expect.arrayContaining(['ENTRY', 'EXIT', 'DENIAL']));
    expect(res.body.count).toBeGreaterThanOrEqual(3);

    // Ordenação: `occurredAt` não crescente.
    const timestamps = res.body.data.map((record: { occurredAt: string }) =>
      Date.parse(record.occurredAt),
    );
    expect(timestamps).toEqual([...timestamps].sort((a, b) => b - a));
  });

  it('resolve os nomes (veículo, departamento, portaria e porteiro)', async () => {
    const res = await request(context.httpServer)
      .get(`/access/records?kind=ENTRY&plate=${vehiclePlate}`)
      .set('Authorization', `Bearer ${porteiroToken}`)
      .expect(200);

    expect(res.body.count).toBe(1);
    expect(res.body.data[0]).toMatchObject({
      kind: 'ENTRY',
      plate: vehiclePlate,
      vehicleModel: 'Onix',
      departmentName: 'Setor do Feed',
      entranceName: 'Portaria do Feed',
      doormanName: 'Usuário de teste',
      driverName: null,
      reason: null,
      observation: null,
      accessId: expect.any(String),
    });
  });

  it('devolve o impedimento com motivo e observação (kind=DENIAL)', async () => {
    const res = await request(context.httpServer)
      .get('/access/records?kind=DENIAL')
      .set('Authorization', `Bearer ${porteiroToken}`)
      .expect(200);

    expect(res.body.data[0]).toMatchObject({
      kind: 'DENIAL',
      plate: denialPlate,
      reason: 'UNREGISTERED',
      observation: 'Placa desconhecida no feed',
      entranceName: 'Portaria do Feed',
      doormanName: 'Usuário de teste',
      vehicleModel: null,
      departmentName: null,
      accessId: null,
    });
  });

  it('filtra por placa (parcial) e não mistura placas diferentes', async () => {
    const res = await request(context.httpServer)
      .get(`/access/records?plate=${vehiclePlate}`)
      .set('Authorization', `Bearer ${porteiroToken}`)
      .expect(200);

    const kindSet = res.body.data.map(
      (record: { kind: string }) => record.kind,
    );
    expect(kindSet).toEqual(expect.arrayContaining(['ENTRY', 'EXIT']));
    expect(
      res.body.data.every((r: { plate: string }) => r.plate === vehiclePlate),
    ).toBe(true);
  });

  it('filtra por portaria e devolve as portarias ativas em parameters', async () => {
    const res = await request(context.httpServer)
      .get(`/access/records?entranceId=${entranceId}&limit=100`)
      .set('Authorization', `Bearer ${porteiroToken}`)
      .expect(200);

    expect(res.body.count).toBeGreaterThanOrEqual(3);
    expect(res.body.parameters).toEqual([
      expect.objectContaining({ key: 'entrance_id', label: 'Portaria' }),
    ]);
    expect(
      res.body.parameters[0].allowed_values.some(
        (entrance: { id: string; name: string }) =>
          entrance.id === entranceId && entrance.name === 'Portaria do Feed',
      ),
    ).toBe(true);
  });

  it('filtra por período (dateFrom no futuro devolve vazio)', async () => {
    const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

    const res = await request(context.httpServer)
      .get(`/access/records?dateFrom=${tomorrow}`)
      .set('Authorization', `Bearer ${porteiroToken}`)
      .expect(200);

    expect(res.body.data).toEqual([]);
    expect(res.body.count).toBe(0);
  });

  it('pagina mantendo o total do filtro em count', async () => {
    const res = await request(context.httpServer)
      .get(`/access/records?plate=${vehiclePlate}&limit=1&offset=0`)
      .set('Authorization', `Bearer ${porteiroToken}`)
      .expect(200);

    expect(res.body.data).toHaveLength(1);
    expect(res.body.count).toBe(2);
  });
});
