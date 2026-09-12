// Supertest
import request from 'supertest';

// Support
import {
  ACCESS_SEEDED,
  AccessIntegrationContext,
  createAccessIntegrationContext,
} from './support/access-integration-context';

jest.setTimeout(120000);

describe('Access integration — GET /access/context (contexto + veredito, ADR 0014)', () => {
  let context: AccessIntegrationContext;
  let adminToken: string;
  let porteiroToken: string;
  let presidenteToken: string;
  let motoristaId: string;
  /** Veículo cadastrado com motorista `can_drive` — ABC1D23. */
  let vehicleId: string;
  /** Veículo cadastrado e bloqueado — BLQ1A23. */
  let blockedVehicleId: string;
  /** Departamento com 1 vaga (cenário de vaga cheia). */
  let singleSlotDepartmentId: string;

  beforeAll(async () => {
    context = await createAccessIntegrationContext();
    adminToken = await context.loginAndGetToken(
      ACCESS_SEEDED.ADMIN_EMAIL,
      ACCESS_SEEDED.ADMIN_PASSWORD,
    );
    await context.seedUserWithRole(
      'porteiro.contexto@teste.local',
      ACCESS_SEEDED.PORTEIRO_ROLE_ID,
    );
    porteiroToken = await context.loginAndGetToken(
      'porteiro.contexto@teste.local',
      ACCESS_SEEDED.ADMIN_PASSWORD,
    );
    // Presidência — sem REGISTER_ENTRY/REGISTER_EXIT/REGISTER_DENIAL (403).
    await context.seedUserWithRole(
      'presidente.contexto@teste.local',
      '20000000-0000-0000-0000-000000000003',
    );
    presidenteToken = await context.loginAndGetToken(
      'presidente.contexto@teste.local',
      ACCESS_SEEDED.ADMIN_PASSWORD,
    );
    await context.seedUserWithRole(
      'motorista.contexto@teste.local',
      ACCESS_SEEDED.PORTEIRO_ROLE_ID,
    );
    motoristaId = (await context.findUserIdByEmail(
      'motorista.contexto@teste.local',
    )) as string;

    // Veículo cadastrado com motorista autorizado.
    const vehicleRes = await request(context.httpServer)
      .post('/vehicles')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        plate: 'ABC1D23',
        model: 'Onix',
        vehicleTypeId: ACCESS_SEEDED.FROTA_TYPE_ID,
      })
      .expect(201);
    vehicleId = vehicleRes.body.id;
    await request(context.httpServer)
      .post(`/vehicles/${vehicleId}/drivers`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ userId: motoristaId, canDrive: true })
      .expect(201);

    // Veículo free_pass — FRE1A23.
    await request(context.httpServer)
      .post('/vehicles')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        plate: 'FRE1A23',
        vehicleTypeId: ACCESS_SEEDED.FROTA_TYPE_ID,
        freePass: true,
      })
      .expect(201);

    // Veículo bloqueado — BLQ1A23.
    const blockedRes = await request(context.httpServer)
      .post('/vehicles')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        plate: 'BLQ1A23',
        vehicleTypeId: ACCESS_SEEDED.FROTA_TYPE_ID,
        freePass: true,
      })
      .expect(201);
    blockedVehicleId = blockedRes.body.id;
    await request(context.httpServer)
      .post('/blocks')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ plate: 'BLQ1A23', reason: 'Documentação irregular' })
      .expect(201);

    // Veículo para o cenário de vaga cheia — CAP2A23 (free_pass).
    await request(context.httpServer)
      .post('/vehicles')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        plate: 'CAP2A23',
        vehicleTypeId: ACCESS_SEEDED.FROTA_TYPE_ID,
        freePass: true,
      })
      .expect(201);

    // Veículo para reentrada — REN2A23 (free_pass).
    await request(context.httpServer)
      .post('/vehicles')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        plate: 'REN2A23',
        vehicleTypeId: ACCESS_SEEDED.FROTA_TYPE_ID,
        freePass: true,
      })
      .expect(201);

    // Departamento com 1 vaga + departamento geral (capacidade total folgada).
    const singleSlot = await request(context.httpServer)
      .post('/departments')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Vaga Única', parkingSpace: 1 })
      .expect(201);
    singleSlotDepartmentId = singleSlot.body.id;

    await request(context.httpServer)
      .post('/departments')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Geral', parkingSpace: 100 })
      .expect(201);
  });

  afterAll(async () => {
    await context.close();
  });

  it('nega acesso sem REGISTER_ENTRY/REGISTER_EXIT/REGISTER_DENIAL (403)', async () => {
    await request(context.httpServer)
      .get('/access/context?plate=ABC1D23')
      .set('Authorization', `Bearer ${presidenteToken}`)
      .expect(403);
  });

  it('rejeita placa inválida (400)', async () => {
    await request(context.httpServer)
      .get('/access/context?plate=ABC')
      .set('Authorization', `Bearer ${porteiroToken}`)
      .expect(400);
  });

  it('libera quando há motorista vinculado autorizado a dirigir (regra 4)', async () => {
    const res = await request(context.httpServer)
      .get('/access/context?plate=ABC1D23')
      .set('Authorization', `Bearer ${porteiroToken}`)
      .expect(200);

    expect(res.body).toMatchObject({
      plate: 'ABC1D23',
      verdict: 'ALLOW',
      requiresRequest: false,
      requiresOverCapacity: false,
      isReentry: false,
      vehicle: {
        id: vehicleId,
        model: 'Onix',
        freePass: false,
        isActive: true,
        isBlocked: false,
      },
      block: null,
    });
    expect(res.body.reasons).toContain('DRIVER_ALLOWED');
    expect(res.body.drivers.linked).toEqual([
      expect.objectContaining({
        id: motoristaId,
        canDrive: true,
        linked: true,
      }),
    ]);
  });

  it('nega por bloqueio ativo devolvendo o motivo (regra 2/20)', async () => {
    const res = await request(context.httpServer)
      .get('/access/context?plate=BLQ1A23')
      .set('Authorization', `Bearer ${porteiroToken}`)
      .expect(200);

    expect(res.body).toMatchObject({
      verdict: 'DENY_BLOCKED',
      requiresRequest: false,
      vehicle: { id: blockedVehicleId, isBlocked: true },
      block: { reason: 'Documentação irregular', blockType: 'MANUAL' },
    });
    expect(res.body.reasons).toContain('BLOCKED');
  });

  it('libera passe livre sem exigir motorista (regra 3)', async () => {
    const res = await request(context.httpServer)
      .get('/access/context?plate=FRE1A23')
      .set('Authorization', `Bearer ${porteiroToken}`)
      .expect(200);

    expect(res.body).toMatchObject({
      verdict: 'ALLOW',
      requiresRequest: false,
    });
    expect(res.body.reasons).toContain('FREE_PASS');
  });

  it('placa não cadastrada sem solicitação exige solicitação nova (regra 5)', async () => {
    const res = await request(context.httpServer)
      .get('/access/context?plate=XYZ9A99')
      .set('Authorization', `Bearer ${porteiroToken}`)
      .expect(200);

    expect(res.body).toMatchObject({
      verdict: 'ALLOW_WITH_REQUEST',
      requiresRequest: true,
      reusableRequestId: null,
      vehicle: null,
      block: null,
    });
    expect(res.body.reasons).toContain('UNREGISTERED_VEHICLE');
  });

  it('reaproveita a solicitação aberta da placa (regra 48)', async () => {
    const created = await request(context.httpServer)
      .post('/access-requests')
      .set('Authorization', `Bearer ${porteiroToken}`)
      .send({
        type: 'BOTH',
        plate: 'NEW1A23',
        contactPhone: '11999998888',
        payload: {
          driver: { name: 'Motorista Novo' },
          vehicle: { model: 'Fiorino', color: 'Branca' },
        },
      })
      .expect(201);

    const res = await request(context.httpServer)
      .get('/access/context?plate=NEW1A23')
      .set('Authorization', `Bearer ${porteiroToken}`)
      .expect(200);

    expect(res.body).toMatchObject({
      verdict: 'ALLOW_WITH_REQUEST',
      requiresRequest: true,
      reusableRequestId: created.body.id,
    });
    expect(res.body.reasons).toEqual(
      expect.arrayContaining(['UNREGISTERED_VEHICLE', 'REQUEST_OPEN']),
    );
    expect(res.body.requests[0]).toMatchObject({
      id: created.body.id,
      status: 'PENDING',
      driverName: 'Motorista Novo',
      isOverdue: false,
      daysSinceRequest: 0,
    });
  });

  it('nega por prazo vencido (PENDING > 3 dias — regra 38)', async () => {
    await request(context.httpServer)
      .post('/access-requests')
      .set('Authorization', `Bearer ${porteiroToken}`)
      .send({
        type: 'BOTH',
        plate: 'OLD1A23',
        contactPhone: '11999997777',
        payload: {
          driver: { name: 'Motorista Antigo' },
          vehicle: { model: 'Uno', color: 'Vermelho' },
        },
      })
      .expect(201);

    await context.dataSource.query(
      `UPDATE "access_request"
          SET "requested_at" = now() - interval '5 days'
        WHERE "plate" = $1`,
      ['OLD1A23'],
    );

    const res = await request(context.httpServer)
      .get('/access/context?plate=OLD1A23')
      .set('Authorization', `Bearer ${porteiroToken}`)
      .expect(200);

    expect(res.body.verdict).toBe('DENY_OVERDUE');
    expect(res.body.reasons).toContain('REQUEST_OVERDUE');
    expect(res.body.requests[0]).toMatchObject({
      isOverdue: true,
      daysSinceRequest: 5,
    });
    expect(res.body.requests[0].deadline).toEqual(expect.any(String));
  });

  it('avisa vaga cheia no setor escolhido (regras 6/25)', async () => {
    // Ocupa a única vaga do setor com uma entrada real.
    await request(context.httpServer)
      .post('/access/entry')
      .set('Authorization', `Bearer ${porteiroToken}`)
      .send({ plate: 'CAP2A23', departmentId: singleSlotDepartmentId })
      .expect(201);

    const res = await request(context.httpServer)
      .get(
        `/access/context?plate=CAP2A23&departmentId=${singleSlotDepartmentId}`,
      )
      .set('Authorization', `Bearer ${porteiroToken}`)
      .expect(200);

    expect(res.body).toMatchObject({
      verdict: 'ALLOW_OVER_CAPACITY',
      requiresOverCapacity: true,
      requiresRequest: false,
      isReentry: true,
      department: {
        id: singleSlotDepartmentId,
        capacity: 1,
        occupied: 1,
        hasFreeSlot: false,
      },
    });
    expect(res.body.reasons).toEqual(
      expect.arrayContaining(['CAPACITY_FULL', 'REENTRY']),
    );
  });

  it('marca reentrada quando o veículo já está dentro (regra 9)', async () => {
    await request(context.httpServer)
      .post('/access/entry')
      .set('Authorization', `Bearer ${porteiroToken}`)
      .send({ plate: 'REN2A23' })
      .expect(201);

    const res = await request(context.httpServer)
      .get('/access/context?plate=REN2A23')
      .set('Authorization', `Bearer ${porteiroToken}`)
      .expect(200);

    expect(res.body).toMatchObject({
      verdict: 'ALLOW_FORCED_REENTRY',
      isReentry: true,
      requiresRequest: false,
    });
    expect(res.body.openAccesses).toHaveLength(1);
    expect(res.body.openAccesses[0]).toMatchObject({
      id: expect.any(String),
      entryAt: expect.any(String),
    });
  });

  it('busca motorista e sugere pessoas sem vínculo (3 + 3 na tela)', async () => {
    // O helper de seed nomeia toda pessoa como `Usuário de teste` — a busca
    // casa pelo nome do motorista vinculado e devolve as demais como sugestão.
    const res = await request(context.httpServer)
      .get('/access/context?plate=ABC1D23&search=Usuário')
      .set('Authorization', `Bearer ${porteiroToken}`)
      .expect(200);

    expect(res.body.drivers.search).toBe('Usuário');
    expect(res.body.drivers.linked.map((d: { id: string }) => d.id)).toContain(
      motoristaId,
    );
    expect(res.body.drivers.suggestions.length).toBeGreaterThan(0);
    expect(
      res.body.drivers.suggestions.every(
        (suggestion: { linked: boolean; id: string }) =>
          suggestion.linked === false && suggestion.id !== motoristaId,
      ),
    ).toBe(true);
  });

  it('falha quando o departamento informado não existe (404)', async () => {
    await request(context.httpServer)
      .get(
        '/access/context?plate=ABC1D23&departmentId=50000000-0000-0000-0000-000000000099',
      )
      .set('Authorization', `Bearer ${porteiroToken}`)
      .expect(404);
  });
});
