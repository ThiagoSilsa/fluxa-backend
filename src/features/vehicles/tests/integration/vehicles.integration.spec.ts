// Supertest
import request from 'supertest';

// Support
import {
  createVehiclesIntegrationContext,
  VEHICLES_SEEDED,
  VehiclesIntegrationContext,
} from './support/vehicles-integration-context';

jest.setTimeout(120000);

describe('Vehicles integration — CRUD de veículos (Testcontainers)', () => {
  let context: VehiclesIntegrationContext;
  let token: string;
  let porteiroToken: string;
  let manageVehiclesToken: string;

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
    // MANAGE_VEHICLES sem GRANT_FREE_PASS — cenário do free_pass 403.
    await context.seedUserWithPermissions('gestor@teste.local', [
      'MANAGE_VEHICLES',
    ]);
    manageVehiclesToken = await context.loginAndGetToken(
      'gestor@teste.local',
      VEHICLES_SEEDED.ADMIN_PASSWORD,
    );
  });

  afterAll(async () => {
    await context.close();
  });

  it('POST /vehicles cria um veículo com placa normalizada e tipo agregado', async () => {
    const res = await request(context.httpServer)
      .post('/vehicles')
      .set('Authorization', `Bearer ${token}`)
      .send({
        plate: ' abc-1d23 ',
        vehicleTypeId: VEHICLES_SEEDED.FROTA_TYPE_ID,
        model: 'Onix',
        color: 'Prata',
      })
      .expect(201);

    expect(res.body).toMatchObject({
      plate: 'ABC1D23',
      model: 'Onix',
      color: 'Prata',
      isBlocked: false,
      freePass: false,
      isActive: true,
      vehicleType: {
        id: VEHICLES_SEEDED.FROTA_TYPE_ID,
        code: 'FROTA',
        name: 'Frota',
        isFleet: true,
      },
    });
    expect(typeof res.body.id).toBe('string');
  });

  it('POST /vehicles com placa inválida → 400', async () => {
    await request(context.httpServer)
      .post('/vehicles')
      .set('Authorization', `Bearer ${token}`)
      .send({ plate: 'ABC12', vehicleTypeId: VEHICLES_SEEDED.FROTA_TYPE_ID })
      .expect(400);
  });

  it('POST /vehicles com is_blocked no body → 400 (derivado)', async () => {
    await request(context.httpServer)
      .post('/vehicles')
      .set('Authorization', `Bearer ${token}`)
      .send({
        plate: 'ABC1234',
        vehicleTypeId: VEHICLES_SEEDED.FROTA_TYPE_ID,
        isBlocked: true,
      })
      .expect(400);
  });

  it('POST /vehicles com tipo inativo → 400', async () => {
    const created = await request(context.httpServer)
      .post('/vehicle-types')
      .set('Authorization', `Bearer ${token}`)
      .send({ code: 'legado', name: 'Legado' })
      .expect(201);
    await request(context.httpServer)
      .delete(`/vehicle-types/${created.body.id}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    await request(context.httpServer)
      .post('/vehicles')
      .set('Authorization', `Bearer ${token}`)
      .send({ plate: 'XYZ1A23', vehicleTypeId: created.body.id })
      .expect(400);
  });

  it('POST /vehicles com placa duplicada → 409', async () => {
    await request(context.httpServer)
      .post('/vehicles')
      .set('Authorization', `Bearer ${token}`)
      .send({ plate: 'ABC1234', vehicleTypeId: VEHICLES_SEEDED.FROTA_TYPE_ID })
      .expect(201);

    await request(context.httpServer)
      .post('/vehicles')
      .set('Authorization', `Bearer ${token}`)
      .send({ plate: 'abc-1234', vehicleTypeId: VEHICLES_SEEDED.FROTA_TYPE_ID })
      .expect(409);
  });

  it('POST /vehicles com free_pass=true exige GRANT_FREE_PASS (403)', async () => {
    await request(context.httpServer)
      .post('/vehicles')
      .set('Authorization', `Bearer ${manageVehiclesToken}`)
      .send({
        plate: 'JKL9M12',
        vehicleTypeId: VEHICLES_SEEDED.FROTA_TYPE_ID,
        freePass: true,
      })
      .expect(403);
  });

  it('POST /vehicles com free_pass=true como admin (GRANT_FREE_PASS) → 201', async () => {
    await request(context.httpServer)
      .post('/vehicles')
      .set('Authorization', `Bearer ${token}`)
      .send({
        plate: 'JKL9M12',
        vehicleTypeId: VEHICLES_SEEDED.FROTA_TYPE_ID,
        freePass: true,
      })
      .expect(201);
  });

  it('GET /vehicles devolve lista no formato padrão com parameters de tipos ativos', async () => {
    const res = await request(context.httpServer)
      .get('/vehicles')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(res.body).toMatchObject({ limit: 20, offset: 0 });
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(typeof res.body.count).toBe('number');
    expect(res.body.parameters).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          key: 'vehicle_type_id',
          label: 'Tipo de veículo',
          allowed_values: expect.arrayContaining([
            expect.objectContaining({ id: VEHICLES_SEEDED.FROTA_TYPE_ID }),
          ]),
        }),
      ]),
    );
  });

  it('GET /vehicles?search= normaliza a placa antes de buscar', async () => {
    const res = await request(context.httpServer)
      .get('/vehicles?search=abc-1d23')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(
      res.body.data.some((v: { plate: string }) => v.plate === 'ABC1D23'),
    ).toBe(true);
  });

  it('GET /vehicles/:id detalha um veículo', async () => {
    const created = await request(context.httpServer)
      .post('/vehicles')
      .set('Authorization', `Bearer ${token}`)
      .send({ plate: 'DEF4G56', vehicleTypeId: VEHICLES_SEEDED.FROTA_TYPE_ID })
      .expect(201);

    const res = await request(context.httpServer)
      .get(`/vehicles/${created.body.id}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(res.body).toMatchObject({ id: created.body.id, plate: 'DEF4G56' });
  });

  it('PATCH /vehicles/:id atualiza modelo/cor', async () => {
    const created = await request(context.httpServer)
      .post('/vehicles')
      .set('Authorization', `Bearer ${token}`)
      .send({ plate: 'HJK7L89', vehicleTypeId: VEHICLES_SEEDED.FROTA_TYPE_ID })
      .expect(201);

    const res = await request(context.httpServer)
      .patch(`/vehicles/${created.body.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ model: 'Cruze', color: 'Preto' })
      .expect(200);

    expect(res.body).toMatchObject({ model: 'Cruze', color: 'Preto' });
  });

  it('DELETE desativa (soft) e PATCH reativa um veículo', async () => {
    const created = await request(context.httpServer)
      .post('/vehicles')
      .set('Authorization', `Bearer ${token}`)
      .send({ plate: 'MNO1P23', vehicleTypeId: VEHICLES_SEEDED.FROTA_TYPE_ID })
      .expect(201);

    const deactivated = await request(context.httpServer)
      .delete(`/vehicles/${created.body.id}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(deactivated.body).toMatchObject({ isActive: false });

    const reactivated = await request(context.httpServer)
      .patch(`/vehicles/${created.body.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ isActive: true })
      .expect(200);
    expect(reactivated.body).toMatchObject({ isActive: true });
  });

  it('GET /vehicles/:id inexistente → 404', async () => {
    await request(context.httpServer)
      .get('/vehicles/00000000-0000-0000-0000-000000000000')
      .set('Authorization', `Bearer ${token}`)
      .expect(404);
  });

  it('rotas sem token → 401', async () => {
    await request(context.httpServer).get('/vehicles').expect(401);
  });

  it('usuário sem MANAGE_VEHICLES → 403', async () => {
    await request(context.httpServer)
      .get('/vehicles')
      .set('Authorization', `Bearer ${porteiroToken}`)
      .expect(403);
  });
});
