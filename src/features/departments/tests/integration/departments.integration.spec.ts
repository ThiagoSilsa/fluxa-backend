// Supertest
import request from 'supertest';

// Support
import {
  createDepartmentsIntegrationContext,
  DEPARTMENTS_SEEDED,
  DepartmentsIntegrationContext,
} from './support/departments-integration-context';

jest.setTimeout(120000);

describe('Departments integration — CRUD de departamentos (Testcontainers)', () => {
  let context: DepartmentsIntegrationContext;
  let token: string;
  let porteiroToken: string;

  beforeAll(async () => {
    context = await createDepartmentsIntegrationContext();
    token = await context.loginAndGetToken(
      DEPARTMENTS_SEEDED.ADMIN_EMAIL,
      DEPARTMENTS_SEEDED.ADMIN_PASSWORD,
    );
    await context.seedUserWithRole(
      'porteiro@teste.local',
      DEPARTMENTS_SEEDED.PORTEIRO_ROLE_ID,
    );
    porteiroToken = await context.loginAndGetToken(
      'porteiro@teste.local',
      DEPARTMENTS_SEEDED.ADMIN_PASSWORD,
    );
  });

  afterAll(async () => {
    await context.close();
  });

  it('POST /departments cria um departamento com vagas', async () => {
    const res = await request(context.httpServer)
      .post('/departments')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Recepção', parkingSpace: 30 })
      .expect(201);

    expect(res.body).toMatchObject({
      name: 'Recepção',
      parkingSpace: 30,
      isActive: true,
    });
    expect(typeof res.body.id).toBe('string');
  });

  it('POST /departments sem parkingSpace → 400 (obrigatório — ADR 0006 §7)', async () => {
    await request(context.httpServer)
      .post('/departments')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Sem Vagas' })
      .expect(400);
  });

  it('POST /departments com parkingSpace negativo → 400', async () => {
    await request(context.httpServer)
      .post('/departments')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Inválido', parkingSpace: -1 })
      .expect(400);
  });

  it('GET /departments devolve lista paginada no formato padrão', async () => {
    const res = await request(context.httpServer)
      .get('/departments')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(res.body).toMatchObject({ limit: 20, offset: 0 });
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(typeof res.body.count).toBe('number');
  });

  it('GET /departments filtra por isActive', async () => {
    const res = await request(context.httpServer)
      .get('/departments?isActive=true')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(res.body.data.every((d: { isActive: boolean }) => d.isActive)).toBe(
      true,
    );
  });

  it('GET /departments/:id detalha um departamento', async () => {
    const created = await request(context.httpServer)
      .post('/departments')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Estacionamento', parkingSpace: 60 })
      .expect(201);

    const res = await request(context.httpServer)
      .get(`/departments/${created.body.id}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(res.body).toMatchObject({
      id: created.body.id,
      name: 'Estacionamento',
      parkingSpace: 60,
    });
  });

  it('PATCH /departments/:id atualiza nome/vagas', async () => {
    const created = await request(context.httpServer)
      .post('/departments')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Almoxarifado', parkingSpace: 10 })
      .expect(201);

    const res = await request(context.httpServer)
      .patch(`/departments/${created.body.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Almoxarifado Central', parkingSpace: 15 })
      .expect(200);

    expect(res.body).toMatchObject({
      name: 'Almoxarifado Central',
      parkingSpace: 15,
    });
  });

  it('DELETE exclui fisicamente (204) e GET :id → 404', async () => {
    const created = await request(context.httpServer)
      .post('/departments')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Temporário', parkingSpace: 5 })
      .expect(201);

    await request(context.httpServer)
      .delete(`/departments/${created.body.id}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(204);

    await request(context.httpServer)
      .get(`/departments/${created.body.id}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(404);
  });

  it('PATCH isActive:false desativa e PATCH isActive:true reativa', async () => {
    const created = await request(context.httpServer)
      .post('/departments')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Desativável', parkingSpace: 8 })
      .expect(201);

    const deactivated = await request(context.httpServer)
      .patch(`/departments/${created.body.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ isActive: false })
      .expect(200);
    expect(deactivated.body).toMatchObject({ isActive: false });

    const reactivated = await request(context.httpServer)
      .patch(`/departments/${created.body.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ isActive: true })
      .expect(200);
    expect(reactivated.body).toMatchObject({ isActive: true });
  });

  it('DELETE com veículos vinculados ao departamento → 409 (bloqueio)', async () => {
    const created = await request(context.httpServer)
      .post('/departments')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Em Uso', parkingSpace: 20 })
      .expect(201);

    // Cria um tipo e um veículo para vincular o departamento padrão.
    const vehicleType = await request(context.httpServer)
      .post('/vehicle-types')
      .set('Authorization', `Bearer ${token}`)
      .send({ code: 'tipo-dep', name: 'Tipo Dep' })
      .expect(201);

    const vehicle = await request(context.httpServer)
      .post('/vehicles')
      .set('Authorization', `Bearer ${token}`)
      .send({
        plate: 'ABC1D23',
        vehicleTypeId: vehicleType.body.id,
        model: 'Veículo de teste',
      })
      .expect(201);

    await request(context.httpServer)
      .put(`/vehicles/${vehicle.body.id}/department`)
      .set('Authorization', `Bearer ${token}`)
      .send({ departmentId: created.body.id })
      .expect(200);

    const res = await request(context.httpServer)
      .delete(`/departments/${created.body.id}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(409);
    expect(res.body.message).toContain('em uso por veículos');

    // O departamento continua existindo (bloqueado, não removido).
    const stillThere = await request(context.httpServer)
      .get(`/departments/${created.body.id}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(stillThere.body).toMatchObject({ name: 'Em Uso' });
  });

  it('GET /departments/:id inexistente → 404', async () => {
    await request(context.httpServer)
      .get('/departments/00000000-0000-0000-0000-000000000000')
      .set('Authorization', `Bearer ${token}`)
      .expect(404);
  });

  it('rotas sem token → 401', async () => {
    await request(context.httpServer).get('/departments').expect(401);
  });

  it('usuário sem MANAGE_DEPARTMENTS → 403', async () => {
    await request(context.httpServer)
      .get('/departments')
      .set('Authorization', `Bearer ${porteiroToken}`)
      .expect(403);
  });
});
