// Supertest
import request from 'supertest';

// Support
import {
  createVehiclesIntegrationContext,
  VEHICLES_SEEDED,
  VehiclesIntegrationContext,
} from './support/vehicles-integration-context';

jest.setTimeout(120000);

describe('Vehicle QR integration — emissão e resolução (Testcontainers)', () => {
  let context: VehiclesIntegrationContext;
  let token: string;
  let porteiroToken: string;
  let vehicleId: string;
  let code: string;

  const createVehicle = async (plate: string): Promise<string> => {
    const res = await request(context.httpServer)
      .post('/vehicles')
      .set('Authorization', `Bearer ${token}`)
      .send({ plate, vehicleTypeId: VEHICLES_SEEDED.FROTA_TYPE_ID })
      .expect(201);
    return res.body.id;
  };

  beforeAll(async () => {
    context = await createVehiclesIntegrationContext();
    token = await context.loginAndGetToken(
      VEHICLES_SEEDED.ADMIN_EMAIL,
      VEHICLES_SEEDED.ADMIN_PASSWORD,
    );
    await context.seedUserWithRole(
      'porteiro@teste.local',
      VEHICLES_SEEDED.PORTEIRO_ROLE_ID,
    );
    porteiroToken = await context.loginAndGetToken(
      'porteiro@teste.local',
      VEHICLES_SEEDED.ADMIN_PASSWORD,
    );

    vehicleId = await createVehicle('QRX1A23');
  });

  afterAll(async () => {
    await context.close();
  });

  it('POST /vehicles/:id/qr emite o QR (code uuid, ativo, issued_by=admin)', async () => {
    const res = await request(context.httpServer)
      .post(`/vehicles/${vehicleId}/qr`)
      .set('Authorization', `Bearer ${token}`)
      .expect(201);

    code = res.body.code;
    expect(res.body).toMatchObject({
      vehicleId,
      isActive: true,
    });
    expect(code).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
    );
  });

  it('POST /vehicles/:id/qr com QR ativo existente → 409', async () => {
    await request(context.httpServer)
      .post(`/vehicles/${vehicleId}/qr`)
      .set('Authorization', `Bearer ${token}`)
      .expect(409);
  });

  it('GET /vehicles/:id/qr devolve o mesmo QR ativo (reimpressão)', async () => {
    const res = await request(context.httpServer)
      .get(`/vehicles/${vehicleId}/qr`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(res.body).toMatchObject({ vehicleId, code, isActive: true });
  });

  it('GET /vehicles/:id/qr devolve 404 quando não há QR ativo', async () => {
    const newVehicleId = await createVehicle('QRY2B34');
    await request(context.httpServer)
      .get(`/vehicles/${newVehicleId}/qr`)
      .set('Authorization', `Bearer ${token}`)
      .expect(404);
  });

  it('GET /qr-codes/:code resolve o veículo (placa, tipo, etc.)', async () => {
    const res = await request(context.httpServer)
      .get(`/qr-codes/${code}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(res.body).toMatchObject({
      id: vehicleId,
      plate: 'QRX1A23',
      vehicleType: { id: VEHICLES_SEEDED.FROTA_TYPE_ID, code: 'FROTA' },
      department: null,
    });
    expect(Array.isArray(res.body.drivers)).toBe(true);
  });

  it('GET /qr-codes/:code com porteiro (REGISTER_ENTRY) → 200', async () => {
    await request(context.httpServer)
      .get(`/qr-codes/${code}`)
      .set('Authorization', `Bearer ${porteiroToken}`)
      .expect(200);
  });

  it('GET /qr-codes/:code desconhecido → 404', async () => {
    await request(context.httpServer)
      .get('/qr-codes/00000000-0000-0000-0000-000000000099')
      .set('Authorization', `Bearer ${token}`)
      .expect(404);
  });

  it('porteiro sem PRINT_QRCODE recebe 403 nas rotas de emissão', async () => {
    await request(context.httpServer)
      .post(`/vehicles/${vehicleId}/qr`)
      .set('Authorization', `Bearer ${porteiroToken}`)
      .expect(403);

    await request(context.httpServer)
      .get(`/vehicles/${vehicleId}/qr`)
      .set('Authorization', `Bearer ${porteiroToken}`)
      .expect(403);
  });

  it('POST /vehicles/:id/qr/reissue revoga o atual e cria novo code', async () => {
    const res = await request(context.httpServer)
      .post(`/vehicles/${vehicleId}/qr/reissue`)
      .set('Authorization', `Bearer ${token}`)
      .expect(201);

    const newCode = res.body.code;
    expect(newCode).not.toBe(code);

    // O adesivo antigo agora está expirado (410).
    await request(context.httpServer)
      .get(`/qr-codes/${code}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(410);

    // O novo resolve normalmente.
    await request(context.httpServer)
      .get(`/qr-codes/${newCode}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    code = newCode;
  });

  it('POST /vehicles/:id/qr/reissue sem QR ativo → 409', async () => {
    const newVehicleId = await createVehicle('QRZ3C45');
    await request(context.httpServer)
      .post(`/vehicles/${newVehicleId}/qr/reissue`)
      .set('Authorization', `Bearer ${token}`)
      .expect(409);
  });

  it('POST /vehicles/:id/qr/revoke desativa o QR (sem criar outro)', async () => {
    await request(context.httpServer)
      .post(`/vehicles/${vehicleId}/qr/revoke`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    // QR expirado na resolução e sem QR ativo para reimprimir.
    await request(context.httpServer)
      .get(`/qr-codes/${code}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(410);

    await request(context.httpServer)
      .get(`/vehicles/${vehicleId}/qr`)
      .set('Authorization', `Bearer ${token}`)
      .expect(404);
  });

  it('POST /vehicles/:id/qr/revoke sem QR ativo → 409', async () => {
    await request(context.httpServer)
      .post(`/vehicles/${vehicleId}/qr/revoke`)
      .set('Authorization', `Bearer ${token}`)
      .expect(409);
  });
});
