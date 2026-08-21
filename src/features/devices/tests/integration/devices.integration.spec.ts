// Supertest
import request from 'supertest';

// Support
import {
  createDevicesIntegrationContext,
  DEVICES_SEEDED,
  DevicesIntegrationContext,
} from './support/devices-integration-context';

jest.setTimeout(120000);

describe('Devices integration — CRUD de dispositivos (Testcontainers)', () => {
  let context: DevicesIntegrationContext;
  let token: string;
  let porteiroToken: string;
  let deviceId: string;
  let entranceId: string;

  beforeAll(async () => {
    context = await createDevicesIntegrationContext();
    token = await context.loginAndGetToken(
      DEVICES_SEEDED.ADMIN_EMAIL,
      DEVICES_SEEDED.ADMIN_PASSWORD,
    );
    await context.seedUserWithRole(
      'porteiro@teste.local',
      DEVICES_SEEDED.PORTEIRO_ROLE_ID,
    );
    porteiroToken = await context.loginAndGetToken(
      'porteiro@teste.local',
      DEVICES_SEEDED.ADMIN_PASSWORD,
    );

    // Portaria para os cenários de vínculo.
    const entranceRes = await request(context.httpServer)
      .post('/entrances')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Portaria Principal' })
      .expect(201);
    entranceId = entranceRes.body.id;
  });

  afterAll(async () => {
    await context.close();
  });

  it('POST /devices cria um dispositivo e devolve o token uma única vez', async () => {
    const res = await request(context.httpServer)
      .post('/devices')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Tablet Portaria 1', platform: 'ANDROID' })
      .expect(201);

    deviceId = res.body.device.id;

    expect(res.body.device).toMatchObject({
      name: 'Tablet Portaria 1',
      platform: 'ANDROID',
      appVersion: null,
      entrance: null,
      isActive: true,
    });
    // Token write-only: nunca dentro de `device` (ADR 0008 §3).
    expect(res.body.device).not.toHaveProperty('token');
    expect(res.body.token).toMatch(/^[0-9a-f]{32}$/);
  });

  it('POST /devices valida plataforma inválida (400)', async () => {
    await request(context.httpServer)
      .post('/devices')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Tablet 2', platform: 'WINDOWS' })
      .expect(400);
  });

  it('POST /devices com portaria inexistente (404) e sem criar o device', async () => {
    await request(context.httpServer)
      .post('/devices')
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: 'Tablet 2',
        platform: 'ANDROID',
        entranceId: '00000000-0000-0000-0000-000000000099',
      })
      .expect(404);
  });

  it('POST /devices vincula uma portaria ativa da empresa', async () => {
    const res = await request(context.httpServer)
      .post('/devices')
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: 'Tablet Portaria 2',
        platform: 'IOS',
        entranceId,
      })
      .expect(201);

    expect(res.body.device.entrance).toEqual({
      id: entranceId,
      name: 'Portaria Principal',
    });
  });

  it('GET /devices devolve lista paginada no formato padrão com parameters', async () => {
    const res = await request(context.httpServer)
      .get('/devices')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(res.body).toMatchObject({ limit: 20, offset: 0 });
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(typeof res.body.count).toBe('number');
    expect(res.body.parameters).toEqual([
      {
        key: 'entrance_id',
        label: 'Portaria',
        allowed_values: expect.arrayContaining([
          { id: entranceId, name: 'Portaria Principal' },
        ]),
      },
    ]);
    // Token nunca aparece na listagem.
    for (const device of res.body.data) {
      expect(device).not.toHaveProperty('token');
    }
  });

  it('GET /devices filtra por busca e estado ativo', async () => {
    const res = await request(context.httpServer)
      .get('/devices?search=Tablet%20Portaria%201&isActive=true')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(res.body.count).toBe(1);
    expect(res.body.data[0].name).toBe('Tablet Portaria 1');
  });

  it('GET /devices/:id detalha o dispositivo (sem token)', async () => {
    const res = await request(context.httpServer)
      .get(`/devices/${deviceId}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(res.body).toMatchObject({
      id: deviceId,
      name: 'Tablet Portaria 1',
      platform: 'ANDROID',
    });
    expect(res.body).not.toHaveProperty('token');
  });

  it('GET /devices/:id devolve 404 para id inexistente', async () => {
    await request(context.httpServer)
      .get('/devices/00000000-0000-0000-0000-000000000099')
      .set('Authorization', `Bearer ${token}`)
      .expect(404);
  });

  it('PATCH /devices/:id atualiza nome e vincula a portaria', async () => {
    const res = await request(context.httpServer)
      .patch(`/devices/${deviceId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Tablet Portaria 1 (renomeado)', entranceId })
      .expect(200);

    expect(res.body).toMatchObject({
      id: deviceId,
      name: 'Tablet Portaria 1 (renomeado)',
      entrance: { id: entranceId, name: 'Portaria Principal' },
    });
    expect(res.body).not.toHaveProperty('token');
  });

  it('PATCH /devices/:id desvincula a portaria com entranceId = null', async () => {
    const res = await request(context.httpServer)
      .patch(`/devices/${deviceId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ entranceId: null })
      .expect(200);

    expect(res.body.entrance).toBeNull();
    expect(res.body.entranceId).toBeNull();
  });

  it('PATCH /devices/:id com portaria inativa devolve 400', async () => {
    // Desativa a portaria criada no beforeAll.
    await request(context.httpServer)
      .patch(`/entrances/${entranceId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ isActive: false })
      .expect(200);

    await request(context.httpServer)
      .patch(`/devices/${deviceId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ entranceId })
      .expect(400);
  });

  it('PATCH /devices/:id desativa o dispositivo (suspensão)', async () => {
    const res = await request(context.httpServer)
      .patch(`/devices/${deviceId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ isActive: false })
      .expect(200);

    expect(res.body.isActive).toBe(false);
  });

  it('POST /devices/:id/rotate-token rotaciona o token (write-only)', async () => {
    const res = await request(context.httpServer)
      .post(`/devices/${deviceId}/rotate-token`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(res.body.token).toMatch(/^[0-9a-f]{32}$/);
    expect(res.body.device).toMatchObject({ id: deviceId });
    expect(res.body.device).not.toHaveProperty('token');
  });

  it('POST /devices/:id/rotate-token devolve 404 para id inexistente', async () => {
    await request(context.httpServer)
      .post('/devices/00000000-0000-0000-0000-000000000099/rotate-token')
      .set('Authorization', `Bearer ${token}`)
      .expect(404);
  });

  it('DELETE /devices/:id exclui fisicamente (204)', async () => {
    await request(context.httpServer)
      .delete(`/devices/${deviceId}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(204);

    await request(context.httpServer)
      .get(`/devices/${deviceId}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(404);
  });

  it('bloqueia acesso sem MANAGE_DEVICES (403)', async () => {
    await request(context.httpServer)
      .get('/devices')
      .set('Authorization', `Bearer ${porteiroToken}`)
      .expect(403);

    await request(context.httpServer)
      .post('/devices')
      .set('Authorization', `Bearer ${porteiroToken}`)
      .send({ name: 'Tablet 3', platform: 'ANDROID' })
      .expect(403);
  });
});
