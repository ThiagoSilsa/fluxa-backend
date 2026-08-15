// Supertest
import request from 'supertest';

// Auth (dados seedados)
import { AUTH_SEEDED } from '../../../auth/tests/integration/support/auth-integration-context';

// Support
import {
  createVehiclesIntegrationContext,
  VEHICLES_SEEDED,
  VehiclesIntegrationContext,
} from './support/vehicles-integration-context';

jest.setTimeout(120000);

describe('Vehicles links integration — vehicle_department e user_vehicle (Testcontainers)', () => {
  let context: VehiclesIntegrationContext;
  let token: string;
  let vehicleId: string;
  let departmentId: string;
  let secondDepartmentId: string;
  let motoristaId: string;

  const createVehicle = (plate: string): Promise<string> =>
    request(context.httpServer)
      .post('/vehicles')
      .set('Authorization', `Bearer ${token}`)
      .send({ plate, vehicleTypeId: VEHICLES_SEEDED.FROTA_TYPE_ID })
      .expect(201)
      .then((res) => res.body.id as string);

  const createDepartment = (
    name: string,
    parkingSpace: number,
  ): Promise<string> =>
    request(context.httpServer)
      .post('/departments')
      .set('Authorization', `Bearer ${token}`)
      .send({ name, parkingSpace })
      .expect(201)
      .then((res) => res.body.id as string);

  beforeAll(async () => {
    context = await createVehiclesIntegrationContext();
    token = await context.loginAndGetToken(
      VEHICLES_SEEDED.ADMIN_EMAIL,
      VEHICLES_SEEDED.ADMIN_PASSWORD,
    );
    await context.seedUserWithRole(
      'motorista@teste.local',
      VEHICLES_SEEDED.PORTEIRO_ROLE_ID,
    );
    motoristaId = (await context.findUserIdByEmail(
      'motorista@teste.local',
    )) as string;

    vehicleId = await createVehicle('ABC1D23');
    departmentId = await createDepartment('Recepção', 30);
    secondDepartmentId = await createDepartment('Estacionamento', 60);
  });

  afterAll(async () => {
    await context.close();
  });

  describe('vehicle_department', () => {
    it('PUT /vehicles/:id/department define o departamento padrão (200)', async () => {
      const res = await request(context.httpServer)
        .put(`/vehicles/${vehicleId}/department`)
        .set('Authorization', `Bearer ${token}`)
        .send({ departmentId })
        .expect(200);

      expect(res.body).toMatchObject({
        vehicleId,
        departmentId,
        department: { id: departmentId, name: 'Recepção' },
        isActive: true,
      });
    });

    it('PUT substitui o departamento padrão (upsert na linha única — ADR 0006 §8)', async () => {
      const res = await request(context.httpServer)
        .put(`/vehicles/${vehicleId}/department`)
        .set('Authorization', `Bearer ${token}`)
        .send({ departmentId: secondDepartmentId })
        .expect(200);

      expect(res.body).toMatchObject({
        departmentId: secondDepartmentId,
        department: { id: secondDepartmentId, name: 'Estacionamento' },
        isActive: true,
      });
    });

    it('PUT com departamento inativo → 400', async () => {
      const inactiveId = await createDepartment('Inativo', 5);
      await request(context.httpServer)
        .delete(`/departments/${inactiveId}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      await request(context.httpServer)
        .put(`/vehicles/${vehicleId}/department`)
        .set('Authorization', `Bearer ${token}`)
        .send({ departmentId: inactiveId })
        .expect(400);
    });

    it('GET /vehicles/:id/department devolve o vínculo ativo; DELETE desativa; GET → 404', async () => {
      await request(context.httpServer)
        .put(`/vehicles/${vehicleId}/department`)
        .set('Authorization', `Bearer ${token}`)
        .send({ departmentId })
        .expect(200);

      const res = await request(context.httpServer)
        .get(`/vehicles/${vehicleId}/department`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
      expect(res.body.department).toMatchObject({ id: departmentId });

      await request(context.httpServer)
        .delete(`/vehicles/${vehicleId}/department`)
        .set('Authorization', `Bearer ${token}`)
        .expect(204);

      await request(context.httpServer)
        .get(`/vehicles/${vehicleId}/department`)
        .set('Authorization', `Bearer ${token}`)
        .expect(404);
    });

    it('PUT reativa a linha desativada (upsert — mesma linha, is_active=true)', async () => {
      const res = await request(context.httpServer)
        .put(`/vehicles/${vehicleId}/department`)
        .set('Authorization', `Bearer ${token}`)
        .send({ departmentId })
        .expect(200);
      expect(res.body.isActive).toBe(true);
    });

    it('PUT com veículo inexistente → 404', async () => {
      await request(context.httpServer)
        .put('/vehicles/00000000-0000-0000-0000-000000000000/department')
        .set('Authorization', `Bearer ${token}`)
        .send({ departmentId })
        .expect(404);
    });
  });

  describe('user_vehicle (motoristas)', () => {
    let primaryVehicleId: string;

    beforeAll(async () => {
      primaryVehicleId = await createVehicle('XYZ2E45');
    });

    it('POST /vehicles/:id/drivers vincula um motorista (201)', async () => {
      const res = await request(context.httpServer)
        .post(`/vehicles/${primaryVehicleId}/drivers`)
        .set('Authorization', `Bearer ${token}`)
        .send({ userId: AUTH_SEEDED.ADMIN_USER_ID, isPrimary: true })
        .expect(201);

      expect(res.body).toMatchObject({
        user: { id: AUTH_SEEDED.ADMIN_USER_ID, name: 'Administrador' },
        isPrimary: true,
        canDrive: true,
      });
    });

    it('POST com vínculo duplicado → 409', async () => {
      await request(context.httpServer)
        .post(`/vehicles/${primaryVehicleId}/drivers`)
        .set('Authorization', `Bearer ${token}`)
        .send({ userId: AUTH_SEEDED.ADMIN_USER_ID })
        .expect(409);
    });

    it('POST com usuário sem vínculo ativo → 404', async () => {
      await request(context.httpServer)
        .post(`/vehicles/${primaryVehicleId}/drivers`)
        .set('Authorization', `Bearer ${token}`)
        .send({ userId: '00000000-0000-0000-0000-000000000000' })
        .expect(404);
    });

    it('is_primary=true substitui o primário anterior (1 primário por veículo)', async () => {
      await request(context.httpServer)
        .post(`/vehicles/${primaryVehicleId}/drivers`)
        .set('Authorization', `Bearer ${token}`)
        .send({ userId: motoristaId })
        .expect(201);

      const res = await request(context.httpServer)
        .patch(`/vehicles/${primaryVehicleId}/drivers/${motoristaId}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ isPrimary: true })
        .expect(200);
      expect(res.body.isPrimary).toBe(true);

      const list = await request(context.httpServer)
        .get(`/vehicles/${primaryVehicleId}/drivers`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
      const adminLink = list.body.drivers.find(
        (d: { user: { id: string } }) =>
          d.user.id === AUTH_SEEDED.ADMIN_USER_ID,
      );
      expect(adminLink.isPrimary).toBe(false);
    });

    it('GET /vehicles/:id/drivers lista com nome, is_primary e can_drive', async () => {
      const res = await request(context.httpServer)
        .get(`/vehicles/${primaryVehicleId}/drivers`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(res.body).toMatchObject({ vehicleId: primaryVehicleId });
      expect(res.body.drivers.length).toBe(2);
      expect(
        res.body.drivers.some(
          (d: { user: { id: string } }) => d.user.id === motoristaId,
        ),
      ).toBe(true);
    });

    it('PATCH ajusta can_drive sem remover+recriar', async () => {
      const res = await request(context.httpServer)
        .patch(`/vehicles/${primaryVehicleId}/drivers/${motoristaId}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ canDrive: false })
        .expect(200);

      expect(res.body).toMatchObject({ canDrive: false });
    });

    it('DELETE /vehicles/:id/drivers/:userId remove fisicamente (204)', async () => {
      await request(context.httpServer)
        .delete(`/vehicles/${primaryVehicleId}/drivers/${motoristaId}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(204);

      const list = await request(context.httpServer)
        .get(`/vehicles/${primaryVehicleId}/drivers`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
      expect(list.body.drivers).toHaveLength(1);
    });

    it('DELETE de vínculo inexistente → 404', async () => {
      await request(context.httpServer)
        .delete(`/vehicles/${primaryVehicleId}/drivers/${motoristaId}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(404);
    });
  });

  describe('detalhe agregado e filtro', () => {
    let aggregateVehicleId: string;

    beforeAll(async () => {
      aggregateVehicleId = await createVehicle('DEF4G56');
      await request(context.httpServer)
        .put(`/vehicles/${aggregateVehicleId}/department`)
        .set('Authorization', `Bearer ${token}`)
        .send({ departmentId })
        .expect(200);
      await request(context.httpServer)
        .post(`/vehicles/${aggregateVehicleId}/drivers`)
        .set('Authorization', `Bearer ${token}`)
        .send({ userId: AUTH_SEEDED.ADMIN_USER_ID })
        .expect(201);
    });

    it('GET /vehicles/:id agrega tipo + departamento + motoristas + is_blocked', async () => {
      const res = await request(context.httpServer)
        .get(`/vehicles/${aggregateVehicleId}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(res.body).toMatchObject({
        id: aggregateVehicleId,
        vehicleType: { id: VEHICLES_SEEDED.FROTA_TYPE_ID },
        department: { id: departmentId, name: 'Recepção' },
        drivers: [
          {
            user: { id: AUTH_SEEDED.ADMIN_USER_ID, name: 'Administrador' },
            isPrimary: false,
            canDrive: true,
          },
        ],
        isBlocked: false,
      });
    });

    it('GET /vehicles?departmentId= filtra por departamento padrão', async () => {
      const res = await request(context.httpServer)
        .get(`/vehicles?departmentId=${departmentId}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(
        res.body.data.some((v: { id: string }) => v.id === aggregateVehicleId),
      ).toBe(true);
    });

    it('GET /vehicles devolve parameters com departamentos ativos', async () => {
      const res = await request(context.httpServer)
        .get('/vehicles')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(res.body.parameters).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            key: 'department_id',
            label: 'Departamento',
            allowed_values: expect.arrayContaining([
              expect.objectContaining({ id: departmentId }),
            ]),
          }),
        ]),
      );
    });
  });
});
