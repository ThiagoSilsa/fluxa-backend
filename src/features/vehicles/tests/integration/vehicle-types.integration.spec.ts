// Supertest
import request from 'supertest';

// Support
import {
  createVehiclesIntegrationContext,
  VEHICLES_SEEDED,
  VehiclesIntegrationContext,
} from './support/vehicles-integration-context';

jest.setTimeout(120000);

describe('Vehicle types integration — CRUD de tipos de veículo (Testcontainers)', () => {
  let context: VehiclesIntegrationContext;
  let token: string;
  let porteiroToken: string;

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
  });

  afterAll(async () => {
    await context.close();
  });

  it('POST /vehicle-types cria um tipo com code normalizado', async () => {
    const res = await request(context.httpServer)
      .post('/vehicle-types')
      .set('Authorization', `Bearer ${token}`)
      .send({ code: ' visitante ', name: 'Visitante', isFleet: false })
      .expect(201);

    expect(res.body).toMatchObject({
      code: 'VISITANTE',
      name: 'Visitante',
      isFleet: false,
      isActive: true,
    });
    expect(typeof res.body.id).toBe('string');
  });

  it('POST /vehicle-types com code duplicado → 409', async () => {
    await request(context.httpServer)
      .post('/vehicle-types')
      .set('Authorization', `Bearer ${token}`)
      .send({ code: 'FROTA', name: 'Duplicado' })
      .expect(409);
  });

  it('GET /vehicle-types devolve lista paginada no formato padrão', async () => {
    const res = await request(context.httpServer)
      .get('/vehicle-types')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(res.body).toMatchObject({ limit: 20, offset: 0 });
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(typeof res.body.count).toBe('number');
    expect(res.body.data.length).toBeGreaterThanOrEqual(2); // FROTA + PARTICULAR seedados
  });

  it('GET /vehicle-types?search= filtra por código/nome', async () => {
    const res = await request(context.httpServer)
      .get('/vehicle-types?search=FRO')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(res.body.data.length).toBeGreaterThan(0);
    expect(
      res.body.data.every(
        (t: { code: string; name: string }) =>
          t.code.includes('FRO') || t.name.includes('FRO'),
      ),
    ).toBe(true);
  });

  it('GET /vehicle-types/:id detalha um tipo', async () => {
    const res = await request(context.httpServer)
      .get(`/vehicle-types/${VEHICLES_SEEDED.FROTA_TYPE_ID}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(res.body).toMatchObject({
      id: VEHICLES_SEEDED.FROTA_TYPE_ID,
      code: 'FROTA',
      name: 'Frota',
      isFleet: true,
    });
  });

  it('PATCH /vehicle-types/:id atualiza código/nome', async () => {
    const created = await request(context.httpServer)
      .post('/vehicle-types')
      .set('Authorization', `Bearer ${token}`)
      .send({ code: 'temporario', name: 'Temporário' })
      .expect(201);

    const res = await request(context.httpServer)
      .patch(`/vehicle-types/${created.body.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ code: 'TEMPORARIO-2', name: 'Temporário 2' })
      .expect(200);

    expect(res.body).toMatchObject({
      code: 'TEMPORARIO-2',
      name: 'Temporário 2',
    });
  });

  it('DELETE exclui fisicamente (204) e GET :id → 404', async () => {
    const created = await request(context.httpServer)
      .post('/vehicle-types')
      .set('Authorization', `Bearer ${token}`)
      .send({ code: 'legado', name: 'Legado' })
      .expect(201);

    await request(context.httpServer)
      .delete(`/vehicle-types/${created.body.id}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(204);

    await request(context.httpServer)
      .get(`/vehicle-types/${created.body.id}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(404);
  });

  it('DELETE com veículos usando o tipo → 409 (bloqueio)', async () => {
    const created = await request(context.httpServer)
      .post('/vehicle-types')
      .set('Authorization', `Bearer ${token}`)
      .send({ code: 'utilitario', name: 'Utilitário' })
      .expect(201);

    await request(context.httpServer)
      .post('/vehicles')
      .set('Authorization', `Bearer ${token}`)
      .send({
        plate: 'ABC1D23',
        vehicleTypeId: created.body.id,
        model: 'Utilitário de teste',
      })
      .expect(201);

    const res = await request(context.httpServer)
      .delete(`/vehicle-types/${created.body.id}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(409);
    expect(res.body.message).toContain('em uso por veículos');

    // O tipo continua existindo (bloqueado, não removido).
    const stillThere = await request(context.httpServer)
      .get(`/vehicle-types/${created.body.id}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(stillThere.body).toMatchObject({ code: 'UTILITARIO' });
  });

  it('PATCH isActive:false desativa e PATCH isActive:true reativa', async () => {
    const created = await request(context.httpServer)
      .post('/vehicle-types')
      .set('Authorization', `Bearer ${token}`)
      .send({ code: 'desativavel', name: 'Desativável' })
      .expect(201);

    const deactivated = await request(context.httpServer)
      .patch(`/vehicle-types/${created.body.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ isActive: false })
      .expect(200);
    expect(deactivated.body).toMatchObject({ isActive: false });

    const reactivated = await request(context.httpServer)
      .patch(`/vehicle-types/${created.body.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ isActive: true })
      .expect(200);
    expect(reactivated.body).toMatchObject({ isActive: true });
  });

  it('GET /vehicle-types/:id inexistente → 404', async () => {
    await request(context.httpServer)
      .get('/vehicle-types/00000000-0000-0000-0000-000000000000')
      .set('Authorization', `Bearer ${token}`)
      .expect(404);
  });

  it('rotas sem token → 401', async () => {
    await request(context.httpServer).get('/vehicle-types').expect(401);
  });

  it('usuário sem MANAGE_VEHICLE_TYPES → 403', async () => {
    await request(context.httpServer)
      .get('/vehicle-types')
      .set('Authorization', `Bearer ${porteiroToken}`)
      .expect(403);
  });
});
