// Supertest
import request from 'supertest';

// Support
import {
  ACCESS_SEEDED,
  AccessIntegrationContext,
  createAccessIntegrationContext,
} from './support/access-integration-context';

jest.setTimeout(120000);

describe('Access integration — entrada/saída/ocupação (Testcontainers, ADR 0010 M3)', () => {
  let context: AccessIntegrationContext;
  let adminToken: string;
  let porteiroToken: string;
  let presidenteToken: string;
  let motoristaId: string;
  let vehicleId: string;
  let departmentId: string;

  beforeAll(async () => {
    context = await createAccessIntegrationContext();
    adminToken = await context.loginAndGetToken(
      ACCESS_SEEDED.ADMIN_EMAIL,
      ACCESS_SEEDED.ADMIN_PASSWORD,
    );
    await context.seedUserWithRole(
      'porteiro@teste.local',
      ACCESS_SEEDED.PORTEIRO_ROLE_ID,
    );
    porteiroToken = await context.loginAndGetToken(
      'porteiro@teste.local',
      ACCESS_SEEDED.ADMIN_PASSWORD,
    );
    // Presidência — sem REGISTER_ENTRY/REGISTER_EXIT (cenários de 403).
    await context.seedUserWithRole(
      'presidente@teste.local',
      '20000000-0000-0000-0000-000000000003',
    );
    presidenteToken = await context.loginAndGetToken(
      'presidente@teste.local',
      ACCESS_SEEDED.ADMIN_PASSWORD,
    );
    await context.seedUserWithRole(
      'motorista@teste.local',
      ACCESS_SEEDED.PORTEIRO_ROLE_ID,
    );
    motoristaId = (await context.findUserIdByEmail(
      'motorista@teste.local',
    )) as string;

    // Veículo cadastrado (com motorista) — ABC1D23.
    const vehicleRes = await request(context.httpServer)
      .post('/vehicles')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ plate: 'ABC1D23', vehicleTypeId: ACCESS_SEEDED.FROTA_TYPE_ID })
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

    // Veículo para reentrada (free_pass) — REN1A23.
    await request(context.httpServer)
      .post('/vehicles')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        plate: 'REN1A23',
        vehicleTypeId: ACCESS_SEEDED.FROTA_TYPE_ID,
        freePass: true,
      })
      .expect(201);

    // Veículo para o cenário de vaga cheia (free_pass — sem motorista).
    await request(context.httpServer)
      .post('/vehicles')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        plate: 'CAP1A23',
        vehicleTypeId: ACCESS_SEEDED.FROTA_TYPE_ID,
        freePass: true,
      })
      .expect(201);

    // Departamento com 1 vaga (cenário de vaga cheia).
    const depRes = await request(context.httpServer)
      .post('/departments')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Vaga Única', parkingSpace: 1 })
      .expect(201);
    departmentId = depRes.body.id;

    // Departamento geral — dá capacidade total folgada às entradas sem setor.
    await request(context.httpServer)
      .post('/departments')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Geral', parkingSpace: 100 })
      .expect(201);
  });

  afterAll(async () => {
    await context.close();
  });

  describe('POST /access/entry (Porteiro, REGISTER_ENTRY)', () => {
    it('libera veículo free_pass sem condutor (regra 3)', async () => {
      const res = await request(context.httpServer)
        .post('/access/entry')
        .set('Authorization', `Bearer ${porteiroToken}`)
        .send({ plate: 'FRE1A23' })
        .expect(201);

      expect(res.body.granted).toBe(true);
      expect(res.body.access).toMatchObject({
        vehicleId: expect.any(String),
        temporaryPlate: null,
        driverUserId: null,
        status: 'INSIDE',
        overCapacity: false,
      });
      expect(res.body.movement.type).toBe('ENTRY');
      expect(res.body.movement.source).toBe('PLATE');
      expect(await context.countInsideByPlate('FRE1A23')).toBe(1);
      expect(await context.countMovementsByType('FRE1A23', 'ENTRY')).toBe(1);
    });

    it('libera veículo cadastrado com condutor can_drive (regra 4)', async () => {
      const res = await request(context.httpServer)
        .post('/access/entry')
        .set('Authorization', `Bearer ${porteiroToken}`)
        .send({ plate: 'ABC1D23', driverUserId: motoristaId })
        .expect(201);

      expect(res.body.granted).toBe(true);
      expect(res.body.access.driverUserId).toBe(motoristaId);
      expect(await context.countInsideByPlate('ABC1D23')).toBe(1);
    });

    it('devolve 403 para quem não tem REGISTER_ENTRY (Presidência)', async () => {
      await request(context.httpServer)
        .post('/access/entry')
        .set('Authorization', `Bearer ${presidenteToken}`)
        .send({ plate: 'FRE1A23' })
        .expect(403);
    });

    it('lança 400 para placa inválida', async () => {
      await request(context.httpServer)
        .post('/access/entry')
        .set('Authorization', `Bearer ${porteiroToken}`)
        .send({ plate: 'ABC12' })
        .expect(400);
    });
  });

  describe('Impedimento automático (ADR 0010 §3)', () => {
    it('nega veículo bloqueado com denial BLOCKED e registra o entry_denial', async () => {
      const blockRes = await request(context.httpServer)
        .post('/blocks')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ plate: 'ABC1D23', reason: 'Furto suspeito' })
        .expect(201);

      const res = await request(context.httpServer)
        .post('/access/entry')
        .set('Authorization', `Bearer ${porteiroToken}`)
        .send({ plate: 'ABC1D23', driverUserId: motoristaId })
        .expect(201);

      expect(res.body.granted).toBe(false);
      expect(res.body.denial).toMatchObject({
        plateSnapshot: 'ABC1D23',
        reason: 'BLOCKED',
        blockId: blockRes.body.id,
      });
      expect(await context.countDenialsByPlate('ABC1D23')).toBe(1);

      // O bloqueio não muda (o porteiro não altera estado de bloqueio).
      await request(context.httpServer)
        .post(`/blocks/${blockRes.body.id}/revoke`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ reason: 'Engano' })
        .expect(200);
    });

    it('nega veículo não cadastrado com denial UNREGISTERED', async () => {
      const res = await request(context.httpServer)
        .post('/access/entry')
        .set('Authorization', `Bearer ${porteiroToken}`)
        .send({ plate: 'ZZZ9A99' })
        .expect(201);

      expect(res.body.granted).toBe(false);
      expect(res.body.denial.reason).toBe('UNREGISTERED');
      expect(await context.countDenialsByPlate('ZZZ9A99')).toBe(1);
    });
  });

  describe('Entrada temporária com solicitação autorizada (ADR 0010 §4)', () => {
    it('libera veículo não cadastrado com access_request entry_authorized', async () => {
      // Porteiro cria solicitação BOTH; admin aceita (resolve + autoriza).
      const created = await request(context.httpServer)
        .post('/access-requests')
        .set('Authorization', `Bearer ${porteiroToken}`)
        .send({
          plate: 'TMP1A23',
          type: 'BOTH',
          contactPhone: '11999999999',
          payload: {
            driver: { name: 'Visitante', email: 'tmp@somar.local' },
            vehicle: { model: 'Gol' },
          },
        })
        .expect(201);
      await request(context.httpServer)
        .post(`/access-requests/${created.body.id}/accept`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ vehicleTypeId: ACCESS_SEEDED.FROTA_TYPE_ID })
        .expect(200);

      const res = await request(context.httpServer)
        .post('/access/entry')
        .set('Authorization', `Bearer ${porteiroToken}`)
        .send({ plate: 'TMP1A23', accessRequestId: created.body.id })
        .expect(201);

      expect(res.body.granted).toBe(true);
      expect(res.body.access).toMatchObject({
        accessRequestId: created.body.id,
        temporaryDriverName: 'Visitante',
      });
      expect(await context.countInsideByPlate('TMP1A23')).toBe(1);
    });
  });

  describe('Vaga cheia (regras 6/25)', () => {
    it('lança 409 ao exceder a capacidade do departamento sem overCapacity', async () => {
      // Preenche a única vaga do departamento (veículo ABC1D23 ainda não está
      // dentro — a can_drive falhou por capacidade antes).
      await request(context.httpServer)
        .post('/access/entry')
        .set('Authorization', `Bearer ${porteiroToken}`)
        .send({ plate: 'ABC1D23', driverUserId: motoristaId, departmentId })
        .expect(201);

      // Segundo veículo na mesma vaga → 409.
      await request(context.httpServer)
        .post('/access/entry')
        .set('Authorization', `Bearer ${porteiroToken}`)
        .send({ plate: 'CAP1A23', driverUserId: motoristaId, departmentId })
        .expect(409);

      // Com overCapacity=true → libera.
      const res = await request(context.httpServer)
        .post('/access/entry')
        .set('Authorization', `Bearer ${porteiroToken}`)
        .send({
          plate: 'CAP1A23',
          driverUserId: motoristaId,
          departmentId,
          overCapacity: true,
        })
        .expect(201);

      expect(res.body.granted).toBe(true);
      expect(res.body.access.overCapacity).toBe(true);
    });
  });

  describe('Reentrada (regra 9)', () => {
    it('fecha o acesso anterior com forced_exit e registra nova entrada', async () => {
      await request(context.httpServer)
        .post('/access/entry')
        .set('Authorization', `Bearer ${porteiroToken}`)
        .send({ plate: 'REN1A23' })
        .expect(201);

      const res = await request(context.httpServer)
        .post('/access/entry')
        .set('Authorization', `Bearer ${porteiroToken}`)
        .send({ plate: 'REN1A23' })
        .expect(201);

      expect(res.body.granted).toBe(true);
      expect(res.body.previousClosed).toMatchObject({
        access: { forcedExit: true, status: 'OUT' },
        movement: { type: 'EXIT' },
      });
      // Nunca 2 INSIDE.
      expect(await context.countInsideByPlate('REN1A23')).toBe(1);
    });
  });

  describe('GET /access/open (conferência na saída)', () => {
    it('devolve quem entrou com o veículo', async () => {
      const res = await request(context.httpServer)
        .get('/access/open?plate=ABC1D23')
        .set('Authorization', `Bearer ${porteiroToken}`)
        .expect(200);

      expect(res.body.data.length).toBeGreaterThanOrEqual(1);
      const entry = res.body.data.find((item: { id: string }) => item.id);
      expect(entry.driver).toEqual({
        id: motoristaId,
        name: 'Usuário de teste',
      });
    });
  });

  describe('POST /access/exit (Porteiro, REGISTER_EXIT)', () => {
    it('encerra os INSIDE abertos gerando os movimentos EXIT (regra 10)', async () => {
      const res = await request(context.httpServer)
        .post('/access/exit')
        .set('Authorization', `Bearer ${porteiroToken}`)
        .send({ plate: 'ABC1D23' })
        .expect(201);

      expect(res.body.closedAccesses.length).toBeGreaterThanOrEqual(1);
      expect(res.body.closedAccesses[0].access.status).toBe('OUT');
      expect(res.body.closedAccesses[0].movement.type).toBe('EXIT');
      expect(res.body.noExit).toBeNull();
      expect(await context.countInsideByPlate('ABC1D23')).toBe(0);
    });

    it('registra NO_EXIT com passageiro quando não há entrada (regra 11)', async () => {
      const res = await request(context.httpServer)
        .post('/access/exit')
        .set('Authorization', `Bearer ${porteiroToken}`)
        .send({ plate: 'ZZZ9A99', temporaryDriverName: 'Passageiro' })
        .expect(201);

      expect(res.body.closedAccesses).toEqual([]);
      expect(res.body.noExit).toMatchObject({
        access: { status: 'NO_EXIT', temporaryPlate: 'ZZZ9A99' },
        movement: { type: 'EXIT' },
      });
      expect(await context.countMovementsByType('ZZZ9A99', 'EXIT')).toBe(1);
    });

    it('lança 400 para NO_EXIT sem passageiro (veículo sem free_pass)', async () => {
      await request(context.httpServer)
        .post('/access/exit')
        .set('Authorization', `Bearer ${porteiroToken}`)
        .send({ plate: 'XYZ9A99' })
        .expect(400);
    });
  });

  describe('GET /access/occupancy (VIEW_DASHBOARDS)', () => {
    it('calcula ocupação total e por departamento', async () => {
      const res = await request(context.httpServer)
        .get('/access/occupancy')
        .set('Authorization', `Bearer ${presidenteToken}`)
        .expect(200);

      expect(res.body).toMatchObject({
        totalCapacity: expect.any(Number),
        freeSlots: expect.any(Number),
      });
      expect(Array.isArray(res.body.byDepartment)).toBe(true);
      const vagaUnica = res.body.byDepartment.find(
        (d: { name: string }) => d.name === 'Vaga Única',
      );
      expect(vagaUnica.occupied).toBeGreaterThanOrEqual(1);
      expect(vagaUnica.capacity).toBe(1);
    });
  });
});
