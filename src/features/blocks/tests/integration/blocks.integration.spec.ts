// Supertest
import request from 'supertest';

// Support
import {
  BLOCKS_SEEDED,
  BlocksIntegrationContext,
  createBlocksIntegrationContext,
} from './support/blocks-integration-context';

jest.setTimeout(120000);

describe('Blocks integration — bloqueios, impedimentos e solicitações (Testcontainers, ADR 0010 M1)', () => {
  let context: BlocksIntegrationContext;
  let adminToken: string;
  let porteiroToken: string;
  let outroPorteiroToken: string;
  let vehicleBlockId: string;
  let blockRequestId: string;

  beforeAll(async () => {
    context = await createBlocksIntegrationContext();
    adminToken = await context.loginAndGetToken(
      BLOCKS_SEEDED.ADMIN_EMAIL,
      BLOCKS_SEEDED.ADMIN_PASSWORD,
    );
    await context.seedUserWithRole(
      'porteiro@teste.local',
      BLOCKS_SEEDED.PORTEIRO_ROLE_ID,
    );
    porteiroToken = await context.loginAndGetToken(
      'porteiro@teste.local',
      BLOCKS_SEEDED.ADMIN_PASSWORD,
    );
    await context.seedUserWithRole(
      'porteiros@teste.local',
      BLOCKS_SEEDED.PORTEIRO_ROLE_ID,
    );
    outroPorteiroToken = await context.loginAndGetToken(
      'porteiros@teste.local',
      BLOCKS_SEEDED.ADMIN_PASSWORD,
    );
  });

  afterAll(async () => {
    await context.close();
  });

  describe('POST /blocks (admin, MANAGE_BLOCKS)', () => {
    it('bloqueia veículo cadastrado e mantém vehicle.is_blocked = true (ADR 0010 §2)', async () => {
      const vehicleRes = await request(context.httpServer)
        .post('/vehicles')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          plate: ' abc-1d23 ',
          vehicleTypeId: BLOCKS_SEEDED.FROTA_TYPE_ID,
          model: 'Onix',
        })
        .expect(201);
      expect(vehicleRes.body.isBlocked).toBe(false);

      const res = await request(context.httpServer)
        .post('/blocks')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ plate: 'ABC1D23', reason: 'Furto suspeito' })
        .expect(201);

      vehicleBlockId = res.body.id;
      expect(res.body).toMatchObject({
        plate: 'ABC1D23',
        vehicleId: vehicleRes.body.id,
        blockType: 'MANUAL',
        reason: 'Furto suspeito',
        status: 'ACTIVE',
        revokedBy: null,
        revokedAt: null,
        revokedReason: null,
      });
      expect(res.body.blockedBy).toMatchObject({ name: 'Administrador' });

      // Derivado mantido na MESMA transação.
      expect(await context.isBlockedByPlate('ABC1D23')).toBe(true);
    });

    it('bloqueia placa de veículo NÃO cadastrado (vehicleId null)', async () => {
      const res = await request(context.httpServer)
        .post('/blocks')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ plate: 'zzz9a99', reason: 'Placa suspeita' })
        .expect(201);

      expect(res.body).toMatchObject({
        plate: 'ZZZ9A99',
        vehicleId: null,
        status: 'ACTIVE',
      });
    });

    it('devolve 409 para placa já bloqueada ativamente', async () => {
      await request(context.httpServer)
        .post('/blocks')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ plate: 'ABC1D23', reason: 'Outro motivo' })
        .expect(409);
    });

    it('devolve 400 para motivo vazio', async () => {
      await request(context.httpServer)
        .post('/blocks')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ plate: 'ABC1234', reason: '   ' })
        .expect(400);
    });
  });

  describe('GET /blocks (admin)', () => {
    it('lista no formato padrão com busca e filtro de status', async () => {
      const res = await request(context.httpServer)
        .get('/blocks?search=ABC&status=ACTIVE&limit=10&offset=0')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(res.body).toMatchObject({ limit: 10, offset: 0 });
      expect(res.body.count).toBe(1);
      expect(res.body.data[0]).toMatchObject({
        plate: 'ABC1D23',
        status: 'ACTIVE',
      });
    });

    it('detalha um bloqueio por id (200) e devolve 404 para id desconhecido', async () => {
      const res = await request(context.httpServer)
        .get(`/blocks/${vehicleBlockId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);
      expect(res.body.id).toBe(vehicleBlockId);

      await request(context.httpServer)
        .get('/blocks/00000000-0000-0000-0000-000000000099')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(404);
    });

    it('devolve 400 para status inválido', async () => {
      await request(context.httpServer)
        .get('/blocks?status=INVALIDO')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(400);
    });
  });

  describe('POST /blocks/:id/revoke (admin)', () => {
    it('revoga e recalcula vehicle.is_blocked = false', async () => {
      const res = await request(context.httpServer)
        .post(`/blocks/${vehicleBlockId}/revoke`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ reason: 'Engano do porteiro' })
        .expect(200);

      expect(res.body).toMatchObject({
        id: vehicleBlockId,
        status: 'REVOKED',
        revokedReason: 'Engano do porteiro',
      });
      expect(res.body.revokedBy).toMatchObject({ name: 'Administrador' });
      expect(await context.isBlockedByPlate('ABC1D23')).toBe(false);
    });

    it('devolve 409 ao revogar bloqueio já revogado', async () => {
      await request(context.httpServer)
        .post(`/blocks/${vehicleBlockId}/revoke`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ reason: 'De novo' })
        .expect(409);
    });

    it('devolve 404 para id desconhecido', async () => {
      await request(context.httpServer)
        .post('/blocks/00000000-0000-0000-0000-000000000099/revoke')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ reason: 'Motivo' })
        .expect(404);
    });
  });

  describe('Autorização (Porteiro sem MANAGE_BLOCKS)', () => {
    it('devolve 403 ao tentar criar/revogar/listar bloqueios', async () => {
      await request(context.httpServer)
        .post('/blocks')
        .set('Authorization', `Bearer ${porteiroToken}`)
        .send({ plate: 'ABC1234', reason: 'Motivo' })
        .expect(403);

      await request(context.httpServer)
        .get('/blocks')
        .set('Authorization', `Bearer ${porteiroToken}`)
        .expect(403);
    });
  });

  describe('POST /entry-denials (Porteiro, REGISTER_DENIAL)', () => {
    it('registra impedimento com placa (snapshot) e observação', async () => {
      const res = await request(context.httpServer)
        .post('/entry-denials')
        .set('Authorization', `Bearer ${porteiroToken}`)
        .send({
          plate: 'ABC1D23',
          reason: 'BLOCKED',
          observation: 'Veículo em ocorrência',
        })
        .expect(201);

      expect(res.body).toMatchObject({
        plateSnapshot: 'ABC1D23',
        reason: 'BLOCKED',
        observation: 'Veículo em ocorrência',
        blockId: null,
      });
      expect(typeof res.body.doormanId).toBe('string');
    });

    it('registra impedimento de placa desconhecida (UNREGISTERED)', async () => {
      const res = await request(context.httpServer)
        .post('/entry-denials')
        .set('Authorization', `Bearer ${porteiroToken}`)
        .send({ plate: 'XYZ9A99', reason: 'UNREGISTERED' })
        .expect(201);

      expect(res.body).toMatchObject({
        plateSnapshot: 'XYZ9A99',
        reason: 'UNREGISTERED',
        vehicleId: null,
      });
    });

    it('devolve 400 para motivo inválido', async () => {
      await request(context.httpServer)
        .post('/entry-denials')
        .set('Authorization', `Bearer ${porteiroToken}`)
        .send({ plate: 'ABC1D23', reason: 'INVALIDO' })
        .expect(400);
    });
  });

  describe('POST /block-requests (Porteiro, CREATE_BLOCK_REQUEST)', () => {
    it('cria solicitação PENDING de placa cadastrada', async () => {
      const res = await request(context.httpServer)
        .post('/block-requests')
        .set('Authorization', `Bearer ${porteiroToken}`)
        .send({ plate: 'REQ1A23', reason: 'Condutor suspeito' })
        .expect(201);

      blockRequestId = res.body.id;
      expect(res.body).toMatchObject({
        plate: 'REQ1A23',
        reason: 'Condutor suspeito',
        status: 'PENDING',
        handledBy: null,
        resolvedBlockId: null,
      });
      expect(res.body.requestedBy).toMatchObject({ name: 'Usuário de teste' });
    });

    it('devolve 409 para placa com solicitação pendente', async () => {
      await request(context.httpServer)
        .post('/block-requests')
        .set('Authorization', `Bearer ${porteiroToken}`)
        .send({ plate: 'REQ1A23', reason: 'Outro motivo' })
        .expect(409);
    });

    it('cria solicitação de placa não cadastrada (vehicleId null)', async () => {
      const res = await request(context.httpServer)
        .post('/block-requests')
        .set('Authorization', `Bearer ${porteiroToken}`)
        .send({ plate: 'REQ2B34', reason: 'Placa suspeita' })
        .expect(201);

      expect(res.body.vehicleId).toBeNull();
    });
  });

  describe('GET /block-requests (admin, MANAGE_BLOCKS)', () => {
    it('lista no formato padrão com filtro de status', async () => {
      const res = await request(context.httpServer)
        .get('/block-requests?status=PENDING&limit=10&offset=0')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(res.body).toMatchObject({ limit: 10, offset: 0 });
      expect(res.body.count).toBeGreaterThanOrEqual(2);
      for (const item of res.body.data) {
        expect(item.status).toBe('PENDING');
      }
    });

    it('devolve 403 para o porteiro (sem MANAGE_BLOCKS)', async () => {
      await request(context.httpServer)
        .get('/block-requests')
        .set('Authorization', `Bearer ${porteiroToken}`)
        .expect(403);
    });
  });

  describe('POST /block-requests/:id/approve (admin)', () => {
    it('aprova criando o bloqueio e ligando resolved_block_id', async () => {
      // Veículo registrado DEPOIS da solicitação — o approve resolve a placa e
      // mantém vehicle.is_blocked = true (ADR 0010 §2).
      await request(context.httpServer)
        .post('/vehicles')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          plate: 'REQ1A23',
          vehicleTypeId: BLOCKS_SEEDED.FROTA_TYPE_ID,
        })
        .expect(201);

      const res = await request(context.httpServer)
        .post(`/block-requests/${blockRequestId}/approve`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ observation: 'Confirmado pela segurança' })
        .expect(200);

      expect(res.body).toMatchObject({
        id: blockRequestId,
        plate: 'REQ1A23',
        status: 'APPROVED',
        observation: 'Confirmado pela segurança',
      });
      expect(typeof res.body.resolvedBlockId).toBe('string');
      expect(res.body.handledBy).toMatchObject({ name: 'Administrador' });

      // Bloqueio criado pela aprovação → derivado true.
      expect(await context.isBlockedByPlate('REQ1A23')).toBe(true);
    });

    it('devolve 409 ao aprovar solicitação já aprovada', async () => {
      await request(context.httpServer)
        .post(`/block-requests/${blockRequestId}/approve`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(409);
    });
  });

  describe('POST /block-requests/:id/reject (admin)', () => {
    it('rejeita sem criar bloqueio', async () => {
      const created = await request(context.httpServer)
        .post('/block-requests')
        .set('Authorization', `Bearer ${porteiroToken}`)
        .send({ plate: 'REQ3C45', reason: 'Placa duvidosa' })
        .expect(201);

      const res = await request(context.httpServer)
        .post(`/block-requests/${created.body.id}/reject`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ observation: 'Sem confirmação' })
        .expect(200);

      expect(res.body).toMatchObject({
        id: created.body.id,
        status: 'REJECTED',
        observation: 'Sem confirmação',
        resolvedBlockId: null,
      });
      // Placa não cadastrada → sem veículo, portanto is_blocked não é true.
      expect(await context.isBlockedByPlate('REQ3C45')).not.toBe(true);
    });
  });

  describe('POST /block-requests/:id/cancel (Porteiro)', () => {
    it('cancela a própria solicitação pendente', async () => {
      const created = await request(context.httpServer)
        .post('/block-requests')
        .set('Authorization', `Bearer ${porteiroToken}`)
        .send({ plate: 'REQ4D56', reason: 'Mudei de ideia' })
        .expect(201);

      const res = await request(context.httpServer)
        .post(`/block-requests/${created.body.id}/cancel`)
        .set('Authorization', `Bearer ${porteiroToken}`)
        .expect(200);

      expect(res.body).toMatchObject({
        id: created.body.id,
        status: 'CANCELLED',
      });
    });

    it('devolve 403 ao cancelar solicitação de OUTRO porteiro', async () => {
      const created = await request(context.httpServer)
        .post('/block-requests')
        .set('Authorization', `Bearer ${porteiroToken}`)
        .send({ plate: 'REQ5E67', reason: 'Placa suspeita' })
        .expect(201);

      await request(context.httpServer)
        .post(`/block-requests/${created.body.id}/cancel`)
        .set('Authorization', `Bearer ${outroPorteiroToken}`)
        .expect(403);
    });
  });
});
