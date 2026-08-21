// NestJS
import { Test } from '@nestjs/testing';

// Shared
import { PermissionCode } from '../../../../shared/constants/access-control.constant';

// Constants
import { UserType } from '../../../auth/domain/constants/user-type.constant';
import { DevicePlatform } from '../../domain/constants/device-platform.constant';

// Types
import type { AuthenticatedUserEntity } from '../../../auth/domain/entities/authenticated-user.entity';
import type { EntranceEntity } from '../../../entrances/domain/entities/entrance.entity';
import type {
  DeviceEntity,
  DeviceWithEntranceEntity,
} from '../../domain/entities/device.entity';
import type { DeviceRepository } from '../../domain/repositories/device.repository';
import type { EntranceRepository } from '../../../entrances/domain/repositories/entrance.repository';

// Repositories
import { DEVICE_REPOSITORY } from '../../domain/repositories/device.repository';
import { ENTRANCE_REPOSITORY } from '../../../entrances/domain/repositories/entrance.repository';

// DTO
import { ListDevicesInputDto } from '../../application/dto/list-devices-input.dto';

// Use case
import { ListDevicesUseCase } from '../../application/use-cases/list-devices.use-case';

describe('ListDevicesUseCase', () => {
  let useCase: ListDevicesUseCase;

  const deviceRepoMock = {
    list: jest.fn(),
  } as jest.Mocked<Pick<DeviceRepository, 'list'>>;

  const entranceRepoMock = {
    list: jest.fn(),
  } as jest.Mocked<Pick<EntranceRepository, 'list'>>;

  const actor: AuthenticatedUserEntity = {
    id: '30000000-0000-0000-0000-000000000001',
    companyId: '10000000-0000-0000-0000-000000000001',
    email: 'admin@somar.local',
    name: 'Administrador',
    type: UserType.EMPLOYEE,
    isAdmin: true,
    roleCodes: ['Administração'],
    permissions: [PermissionCode.MANAGE_DEVICES],
  };

  const device: DeviceEntity = {
    id: '40000000-0000-0000-0000-000000000010',
    companyId: actor.companyId,
    name: 'Tablet Portaria 1',
    token: 'a'.repeat(32),
    platform: DevicePlatform.ANDROID,
    appVersion: null,
    entranceId: null,
    lastSyncAt: null,
    isActive: true,
    createdAt: new Date('2026-08-21T00:00:00Z'),
    updatedAt: new Date('2026-08-21T00:00:00Z'),
  };

  const withEntrance: DeviceWithEntranceEntity = { ...device, entrance: null };

  const entrance: EntranceEntity = {
    id: '40000000-0000-0000-0000-000000000002',
    companyId: actor.companyId,
    name: 'Portaria Principal',
    isActive: true,
    createdAt: new Date('2026-08-15T00:00:00Z'),
    updatedAt: new Date('2026-08-15T00:00:00Z'),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module = await Test.createTestingModule({
      providers: [
        ListDevicesUseCase,
        { provide: DEVICE_REPOSITORY, useValue: deviceRepoMock },
        { provide: ENTRANCE_REPOSITORY, useValue: entranceRepoMock },
      ],
    }).compile();
    useCase = module.get(ListDevicesUseCase);
  });

  it('lista dispositivos no formato padrão com parameters de portarias ativas', async () => {
    deviceRepoMock.list.mockResolvedValue({ data: [withEntrance], count: 1 });
    entranceRepoMock.list.mockResolvedValue({
      data: [entrance],
      count: 1,
    });

    const result = await useCase.execute(
      actor,
      new ListDevicesInputDto(
        undefined,
        undefined,
        undefined,
        undefined,
        20,
        0,
      ),
    );

    expect(deviceRepoMock.list).toHaveBeenCalledWith(actor.companyId, {
      search: undefined,
      isActive: undefined,
      sortBy: undefined,
      sortOrder: undefined,
      limit: 20,
      offset: 0,
    });
    expect(entranceRepoMock.list).toHaveBeenCalledWith(actor.companyId, {
      isActive: true,
      limit: 100,
      offset: 0,
    });
    expect(result).toMatchObject({
      limit: 20,
      offset: 0,
      count: 1,
    });
    expect(result.data).toHaveLength(1);
    // O token nunca aparece na listagem (write-only — ADR 0008 §3).
    expect(result.data[0]).not.toHaveProperty('token');
    expect(result.parameters).toEqual([
      {
        key: 'entrance_id',
        label: 'Portaria',
        allowed_values: [{ id: entrance.id, name: entrance.name }],
      },
    ]);
  });

  it('repassa busca, filtro e ordenação ao repositório', async () => {
    deviceRepoMock.list.mockResolvedValue({ data: [], count: 0 });
    entranceRepoMock.list.mockResolvedValue({ data: [], count: 0 });

    await useCase.execute(
      actor,
      new ListDevicesInputDto('Tablet', true, 'lastSyncAt', 'DESC', 10, 5),
    );

    expect(deviceRepoMock.list).toHaveBeenCalledWith(actor.companyId, {
      search: 'Tablet',
      isActive: true,
      sortBy: 'lastSyncAt',
      sortOrder: 'DESC',
      limit: 10,
      offset: 5,
    });
  });
});
