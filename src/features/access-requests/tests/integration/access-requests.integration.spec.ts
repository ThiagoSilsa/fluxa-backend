// Supertest
import request from 'supertest';

// Support
import {
  ACCESS_REQUESTS_SEEDED,
  AccessRequestsIntegrationContext,
  createAccessRequestsIntegrationContext,
} from './support/access-requests-integration-context';

jest.setTimeout(120000);

describe('Access requests integration — solicitações de acesso (Testcontainers, ADR 0010 M2)', () => {
  let context: AccessRequestsIntegrationContext;
  let adminToken: string;
  let porteiroToken: string;
  let outroPorteiroToken: string;
  let vehicleId: string;
  let departmentId: string;
  let motoristaId: string;
  let newUserRequestId: string;

  beforeAll(async () => {
    context = await createAccessRequestsIntegrationContext();
    adminToken = await context.loginAndGetToken(
      ACCESS_REQUESTS_SEEDED.ADMIN_EMAIL,
      ACCESS_REQUESTS_SEEDED.ADMIN_PASSWORD,
    );
    await context.seedUserWithRole(
      'porteiro@teste.local',
      ACCESS_REQUESTS_SEEDED.PORTEIRO_ROLE_ID,
    );
    porteiroToken = await context.loginAndGetToken(
      'porteiro@teste.local',
      ACCESS_REQUESTS_SEEDED.ADMIN_PASSWORD,
    );
    await context.seedUserWithRole(
      'porteiros@teste.local',
      ACCESS_REQUESTS_SEEDED.PORTEIRO_ROLE_ID,
    );
    outroPorteiroToken = await context.loginAndGetToken(
      'porteiros@teste.local',
      ACCESS_REQUESTS_SEEDED.ADMIN_PASSWORD,
    );
    // Usuário existente na empresa (cenários NEW_VEHICLE/LINK).
    await context.seedUserWithRole(
      'motorista@teste.local',
      ACCESS_REQUESTS_SEEDED.PORTEIRO_ROLE_ID,
    );
    motoristaId = (await context.findUserIdByEmail(
      'motorista@teste.local',
    )) as string;

    const vehicleRes = await request(context.httpServer)
      .post('/vehicles')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        plate: 'ABC1D23',
        vehicleTypeId: ACCESS_REQUESTS_SEEDED.FROTA_TYPE_ID,
        model: 'Onix',
      })
      .expect(201);
    vehicleId = vehicleRes.body.id;

    const depRes = await request(context.httpServer)
      .post('/departments')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Recepção', parkingSpace: 10 })
      .expect(201);
    departmentId = depRes.body.id;
  });

  afterAll(async () => {
    await context.close();
  });

  describe('POST /access-requests (Porteiro, CREATE_ACCESS_REQUEST)', () => {
    it('cria solicitação NEW_USER de veículo cadastrado com contato e departamento', async () => {
      const res = await request(context.httpServer)
        .post('/access-requests')
        .set('Authorization', `Bearer ${porteiroToken}`)
        .send({
          plate: 'ABC1D23',
          type: 'NEW_USER',
          vehicleId,
          contactChannel: 'WHATSAPP',
          contactPhone: '11999999999',
          departmentId,
          payload: {
            driver: { name: 'Visitante', email: 'visitante@somar.local' },
          },
        })
        .expect(201);

      newUserRequestId = res.body.id;
      expect(res.body).toMatchObject({
        plate: 'ABC1D23',
        type: 'NEW_USER',
        vehicleId,
        status: 'PENDING',
        entryAuthorized: false,
        contactChannel: 'WHATSAPP',
        contactPhone: '11999999999',
        departmentId,
        handledBy: null,
        authorizedBy: null,
      });
      expect(res.body.requestedBy).toMatchObject({ name: 'Usuário de teste' });
      expect(res.body.payload).toMatchObject({
        driver: { name: 'Visitante', email: 'visitante@somar.local' },
      });
    });

    it('devolve 409 para placa com solicitação aberta (duplicidade)', async () => {
      await request(context.httpServer)
        .post('/access-requests')
        .set('Authorization', `Bearer ${porteiroToken}`)
        .send({
          plate: 'ABC1D23',
          type: 'NEW_USER',
          vehicleId,
          contactPhone: '11999999999',
          payload: {
            driver: { name: 'Outro', email: 'outro@somar.local' },
          },
        })
        .expect(409);
    });

    it('devolve 400 para NEW_USER sem telefone de contato (regra 43)', async () => {
      await request(context.httpServer)
        .post('/access-requests')
        .set('Authorization', `Bearer ${porteiroToken}`)
        .send({
          plate: 'ABC1D23',
          type: 'NEW_USER',
          vehicleId,
          payload: {
            driver: { name: 'Sem contato', email: 'sem@somar.local' },
          },
        })
        .expect(400);
    });

    it('devolve 404 para departamento inexistente (regra 46)', async () => {
      await request(context.httpServer)
        .post('/access-requests')
        .set('Authorization', `Bearer ${porteiroToken}`)
        .send({
          plate: 'XYZ9A99',
          type: 'BOTH',
          contactPhone: '11999999999',
          departmentId: '00000000-0000-0000-0000-000000000099',
          payload: {
            driver: { name: 'Visitante', email: 'dep@somar.local' },
            vehicle: { model: 'Onix' },
          },
        })
        .expect(404);
    });

    it('devolve 400 para placa inválida', async () => {
      await request(context.httpServer)
        .post('/access-requests')
        .set('Authorization', `Bearer ${porteiroToken}`)
        .send({ plate: 'ABC12', type: 'LINK', vehicleId, userId: motoristaId })
        .expect(400);
    });
  });

  describe('GET /access-requests (admin, MANAGE_ACCESS_REQUESTS)', () => {
    it('lista no formato padrão com filtro de status', async () => {
      const res = await request(context.httpServer)
        .get('/access-requests?status=PENDING&limit=10&offset=0')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(res.body).toMatchObject({ limit: 10, offset: 0 });
      expect(res.body.count).toBeGreaterThanOrEqual(1);
      for (const item of res.body.data) {
        expect(item.status).toBe('PENDING');
      }
    });

    it('devolve 403 para o porteiro (sem MANAGE_ACCESS_REQUESTS)', async () => {
      await request(context.httpServer)
        .get('/access-requests')
        .set('Authorization', `Bearer ${porteiroToken}`)
        .expect(403);
    });

    it('detalha uma solicitação por id (200) e 404 para id desconhecido', async () => {
      const res = await request(context.httpServer)
        .get(`/access-requests/${newUserRequestId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);
      expect(res.body.id).toBe(newUserRequestId);

      await request(context.httpServer)
        .get('/access-requests/00000000-0000-0000-0000-000000000099')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(404);
    });
  });

  describe('POST /access-requests/:id/accept (admin) — resolução retroativa', () => {
    it('aceita NEW_USER criando usuário VISITOR + vínculo e autoriza a entrada', async () => {
      const res = await request(context.httpServer)
        .post(`/access-requests/${newUserRequestId}/accept`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ observation: 'Confirmado' })
        .expect(200);

      expect(res.body).toMatchObject({
        id: newUserRequestId,
        status: 'REGISTERED',
        entryAuthorized: true,
        observation: 'Confirmado',
      });
      expect(typeof res.body.resolvedUserId).toBe('string');
      expect(res.body.resolvedVehicleId).toBe(vehicleId);
      expect(res.body.handledBy).toMatchObject({ name: 'Administrador' });
      expect(res.body.authorizedBy).toMatchObject({ name: 'Administrador' });

      // Usuário VISITOR criado + vínculo user_vehicle.
      expect(await context.isUserByEmail('visitante@somar.local')).toBe(true);
      const visitanteId = await context.findUserIdByEmail(
        'visitante@somar.local',
      );
      expect(
        await context.isLinkByUserAndVehicle(visitanteId as string, vehicleId),
      ).toBe(true);
    });

    it('devolve 409 ao aceitar solicitação já registrada', async () => {
      await request(context.httpServer)
        .post(`/access-requests/${newUserRequestId}/accept`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(409);
    });

    it('aceita NEW_VEHICLE criando veículo com o tipo escolhido + vínculo', async () => {
      const created = await request(context.httpServer)
        .post('/access-requests')
        .set('Authorization', `Bearer ${porteiroToken}`)
        .send({
          plate: 'NEW1A23',
          type: 'NEW_VEHICLE',
          userId: motoristaId,
          contactPhone: '11988888888',
          payload: { vehicle: { model: 'Uno', color: 'Branco' } },
        })
        .expect(201);

      const res = await request(context.httpServer)
        .post(`/access-requests/${created.body.id}/accept`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ vehicleTypeId: ACCESS_REQUESTS_SEEDED.FROTA_TYPE_ID })
        .expect(200);

      expect(res.body.status).toBe('REGISTERED');
      expect(res.body.resolvedVehicleId).not.toBeNull();
      expect(res.body.resolvedUserId).toBe(motoristaId);
      expect(await context.isVehicleByPlate('NEW1A23')).toBe(true);
      expect(
        await context.isLinkByUserAndVehicle(
          motoristaId,
          res.body.resolvedVehicleId,
        ),
      ).toBe(true);
    });

    it('aceita LINK criando apenas o vínculo (ambos existem)', async () => {
      const created = await request(context.httpServer)
        .post('/access-requests')
        .set('Authorization', `Bearer ${porteiroToken}`)
        .send({
          plate: 'ABC1D23',
          type: 'LINK',
          vehicleId,
          userId: motoristaId,
        })
        .expect(201);

      const res = await request(context.httpServer)
        .post(`/access-requests/${created.body.id}/accept`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ canDrive: true, isPrimary: true })
        .expect(200);

      expect(res.body.status).toBe('REGISTERED');
      expect(res.body.resolvedVehicleId).toBe(vehicleId);
      expect(res.body.resolvedUserId).toBe(motoristaId);
      expect(await context.isLinkByUserAndVehicle(motoristaId, vehicleId)).toBe(
        true,
      );
    });

    it('aceita BOTH criando usuário + veículo + vínculo', async () => {
      const created = await request(context.httpServer)
        .post('/access-requests')
        .set('Authorization', `Bearer ${porteiroToken}`)
        .send({
          plate: 'BOT1A23',
          type: 'BOTH',
          contactPhone: '11977777777',
          payload: {
            driver: { name: 'Novo Motorista', email: 'novo@somar.local' },
            vehicle: { model: 'Gol' },
          },
        })
        .expect(201);

      const res = await request(context.httpServer)
        .post(`/access-requests/${created.body.id}/accept`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ vehicleTypeId: ACCESS_REQUESTS_SEEDED.FROTA_TYPE_ID })
        .expect(200);

      expect(res.body.status).toBe('REGISTERED');
      expect(typeof res.body.resolvedUserId).toBe('string');
      expect(typeof res.body.resolvedVehicleId).toBe('string');
      expect(await context.isUserByEmail('novo@somar.local')).toBe(true);
      expect(await context.isVehicleByPlate('BOT1A23')).toBe(true);
      const novoId = await context.findUserIdByEmail('novo@somar.local');
      expect(
        await context.isLinkByUserAndVehicle(
          novoId as string,
          res.body.resolvedVehicleId,
        ),
      ).toBe(true);
    });
  });

  describe('POST /access-requests/:id/reject (admin)', () => {
    it('rejeita sem criar cadastros', async () => {
      const created = await request(context.httpServer)
        .post('/access-requests')
        .set('Authorization', `Bearer ${porteiroToken}`)
        .send({
          plate: 'REJ1A23',
          type: 'BOTH',
          contactPhone: '11966666666',
          payload: {
            driver: { name: 'Rejeitado', email: 'rejeitado@somar.local' },
            vehicle: { model: 'Corsa' },
          },
        })
        .expect(201);

      const res = await request(context.httpServer)
        .post(`/access-requests/${created.body.id}/reject`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ observation: 'Sem confirmação' })
        .expect(200);

      expect(res.body).toMatchObject({
        id: created.body.id,
        status: 'REJECTED',
        observation: 'Sem confirmação',
        entryAuthorized: false,
      });
      expect(await context.isUserByEmail('rejeitado@somar.local')).toBe(false);
    });
  });

  describe('POST /access-requests/:id/in-contact (admin)', () => {
    it('marca como IN_CONTACT (regra 39)', async () => {
      const created = await request(context.httpServer)
        .post('/access-requests')
        .set('Authorization', `Bearer ${porteiroToken}`)
        .send({
          plate: 'CON1A23',
          type: 'BOTH',
          contactPhone: '11955555555',
          payload: {
            driver: { name: 'Contato', email: 'contato@somar.local' },
            vehicle: { model: 'Palio' },
          },
        })
        .expect(201);

      const res = await request(context.httpServer)
        .post(`/access-requests/${created.body.id}/in-contact`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ observation: 'Liguei para o motorista' })
        .expect(200);

      expect(res.body).toMatchObject({
        id: created.body.id,
        status: 'IN_CONTACT',
      });
      expect(res.body.handledBy).toMatchObject({ name: 'Administrador' });
    });
  });

  describe('POST /access-requests/:id/cancel (Porteiro)', () => {
    it('cancela a própria solicitação pendente', async () => {
      const created = await request(context.httpServer)
        .post('/access-requests')
        .set('Authorization', `Bearer ${porteiroToken}`)
        .send({
          plate: 'CAN1A23',
          type: 'BOTH',
          contactPhone: '11944444444',
          payload: {
            driver: { name: 'Cancelar', email: 'cancelar@somar.local' },
            vehicle: { model: 'Fiesta' },
          },
        })
        .expect(201);

      const res = await request(context.httpServer)
        .post(`/access-requests/${created.body.id}/cancel`)
        .set('Authorization', `Bearer ${porteiroToken}`)
        .expect(200);

      expect(res.body).toMatchObject({
        id: created.body.id,
        status: 'CANCELLED',
      });
    });

    it('devolve 403 ao cancelar solicitação de OUTRO porteiro', async () => {
      const created = await request(context.httpServer)
        .post('/access-requests')
        .set('Authorization', `Bearer ${porteiroToken}`)
        .send({
          plate: 'CAN2A23',
          type: 'BOTH',
          contactPhone: '11933333333',
          payload: {
            driver: { name: 'Outro', email: 'outro@somar.local' },
            vehicle: { model: 'Gol' },
          },
        })
        .expect(201);

      await request(context.httpServer)
        .post(`/access-requests/${created.body.id}/cancel`)
        .set('Authorization', `Bearer ${outroPorteiroToken}`)
        .expect(403);
    });
  });
});
