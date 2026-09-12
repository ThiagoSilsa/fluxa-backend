// Supertest
import request from 'supertest';

// Support
import {
  ACCESS_SEEDED,
  AccessIntegrationContext,
  createAccessIntegrationContext,
} from './support/access-integration-context';

jest.setTimeout(120000);

describe('Access integration — ficha de conferência (open/exit, regra 8)', () => {
  let context: AccessIntegrationContext;
  let adminToken: string;
  let porteiroToken: string;
  let driverId: string;
  let entranceId: string;
  let departmentId: string;
  const plate = 'FIC1A23';

  beforeAll(async () => {
    context = await createAccessIntegrationContext();
    adminToken = await context.loginAndGetToken(
      ACCESS_SEEDED.ADMIN_EMAIL,
      ACCESS_SEEDED.ADMIN_PASSWORD,
    );
    await context.seedUserWithRole(
      'porteiro.ficha@teste.local',
      ACCESS_SEEDED.PORTEIRO_ROLE_ID,
    );
    porteiroToken = await context.loginAndGetToken(
      'porteiro.ficha@teste.local',
      ACCESS_SEEDED.ADMIN_PASSWORD,
    );

    // Condutor com telefone (atributo da pessoa — exibido online).
    await context.seedUserWithRole(
      'motorista.ficha@teste.local',
      ACCESS_SEEDED.PORTEIRO_ROLE_ID,
    );
    driverId = (await context.findUserIdByEmail(
      'motorista.ficha@teste.local',
    )) as string;
    await request(context.httpServer)
      .patch(`/users/${driverId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ phone: '11999992222' })
      .expect(200);

    // Portaria + setor.
    const entranceRes = await request(context.httpServer)
      .post('/entrances')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Portaria da Ficha' })
      .expect(201);
    entranceId = entranceRes.body.id;

    const departmentRes = await request(context.httpServer)
      .post('/departments')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Setor da Ficha', parkingSpace: 50 })
      .expect(201);
    departmentId = departmentRes.body.id;

    // Veículo cadastrado (não free_pass) com o condutor vinculado.
    const vehicleRes = await request(context.httpServer)
      .post('/vehicles')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        plate,
        model: 'Onix',
        color: 'Prata',
        vehicleTypeId: ACCESS_SEEDED.FROTA_TYPE_ID,
      })
      .expect(201);
    await request(context.httpServer)
      .post(`/vehicles/${vehicleRes.body.id}/drivers`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ userId: driverId, canDrive: true })
      .expect(201);
  });

  afterAll(async () => {
    await context.close();
  });

  it('devolve a ficha completa na conferência de saída', async () => {
    await request(context.httpServer)
      .post('/access/entry')
      .set('Authorization', `Bearer ${porteiroToken}`)
      .send({ plate, driverUserId: driverId, departmentId, entranceId })
      .expect(201);

    const res = await request(context.httpServer)
      .get(`/access/open?plate=${plate}`)
      .set('Authorization', `Bearer ${porteiroToken}`)
      .expect(200);

    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0]).toMatchObject({
      departmentId,
      departmentName: 'Setor da Ficha',
      driver: {
        id: driverId,
        name: 'Usuário de teste',
        phone: '11999992222',
      },
      vehicle: {
        plate,
        model: 'Onix',
        color: 'Prata',
        freePass: false,
        vehicleType: expect.objectContaining({ code: 'FROTA' }),
      },
    });
  });

  it('devolve a mesma ficha no resultado da saída', async () => {
    const res = await request(context.httpServer)
      .post('/access/exit')
      .set('Authorization', `Bearer ${porteiroToken}`)
      .send({ plate, entranceId })
      .expect(201);

    expect(res.body.noExit).toBeNull();
    expect(res.body.closedAccesses).toHaveLength(1);
    expect(res.body.closedAccesses[0]).toMatchObject({
      access: { status: 'OUT' },
      movement: { type: 'EXIT', plateSnapshot: plate },
      departmentName: 'Setor da Ficha',
      driver: {
        id: driverId,
        name: 'Usuário de teste',
        phone: '11999992222',
      },
      vehicle: { plate, model: 'Onix', freePass: false },
    });
  });

  it('devolve ficha vazia (sem veículo) para a saída sem entrada (NO_EXIT)', async () => {
    const res = await request(context.httpServer)
      .post('/access/exit')
      .set('Authorization', `Bearer ${porteiroToken}`)
      .send({ plate: 'ZZZ9A99', temporaryDriverName: 'Passageiro Avulso' })
      .expect(201);

    expect(res.body.closedAccesses).toEqual([]);
    expect(res.body.noExit).toMatchObject({
      access: { status: 'NO_EXIT', temporaryPlate: 'ZZZ9A99' },
      driver: { id: null, name: 'Passageiro Avulso', phone: null },
      departmentName: null,
      vehicle: null,
    });
  });
});
