// NestJS
import { NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';

// Shared
import { PermissionCode } from '../../../../shared/constants/access-control.constant';

// Constants
import { UserType } from '../../../auth/domain/constants/user-type.constant';
import { DevicePlatform } from '../../domain/constants/device-platform.constant';

// Types
import type { AuthenticatedUserEntity } from '../../../auth/domain/entities/authenticated-user.entity';
import type { DeviceWithEntranceEntity } from '../../domain/entities/device.entity';
import type { DeviceRepository } from '../../domain/repositories/device.repository';

// Repository
import { DEVICE_REPOSITORY } from '../../domain/repositories/device.repository';

// DTO
import { GetDeviceInputDto } from '../../application/dto/get-device-input.dto';

// Use case
import { GetDeviceUseCase } from '../../application/use-cases/get-device.use-case';

describe('GetDeviceUseCase', () => {
  let useCase: GetDeviceUseCase;

  const deviceRepoMock = {
    findByIdAndCompanyId: jest.fn(),
  } as jest.Mocked<Pick<DeviceRepository, 'findByIdAndCompanyId'>>;

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

  const device: DeviceWithEntranceEntity = {
    id: '40000000-0000-0000-0000-000000000010',
    companyId: actor.companyId,
    name: 'Tablet Portaria 1',
    token: 'a'.repeat(32),
    platform: DevicePlatform.ANDROID,
    appVersion: '1.2.0',
    entranceId: '40000000-0000-0000-0000-000000000002',
    entrance: {
      id: '40000000-0000-0000-0000-000000000002',
      name: 'Portaria Principal',
    },
    lastSyncAt: new Date('2026-08-21T10:00:00Z'),
    isActive: true,
    createdAt: new Date('2026-08-21T00:00:00Z'),
    updatedAt: new Date('2026-08-21T00:00:00Z'),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module = await Test.createTestingModule({
      providers: [
        GetDeviceUseCase,
        { provide: DEVICE_REPOSITORY, useValue: deviceRepoMock },
      ],
    }).compile();
    useCase = module.get(GetDeviceUseCase);
  });

  it('detalha o dispositivo da empresa com a portaria agregada', async () => {
    deviceRepoMock.findByIdAndCompanyId.mockResolvedValue(device);

    const result = await useCase.execute(
      actor,
      new GetDeviceInputDto(device.id),
    );

    expect(deviceRepoMock.findByIdAndCompanyId).toHaveBeenCalledWith(
      device.id,
      actor.companyId,
    );
    expect(result).toMatchObject({
      id: device.id,
      name: 'Tablet Portaria 1',
      platform: DevicePlatform.ANDROID,
      appVersion: '1.2.0',
      entrance: { id: device.entranceId, name: 'Portaria Principal' },
      lastSyncAt: '2026-08-21T10:00:00.000Z',
      isActive: true,
    });
    // O token nunca aparece no detalhe (write-only — ADR 0008 §3).
    expect(result).not.toHaveProperty('token');
  });

  it('lança NotFoundException quando o dispositivo não existe na empresa', async () => {
    deviceRepoMock.findByIdAndCompanyId.mockResolvedValue(null);

    await expect(
      useCase.execute(actor, new GetDeviceInputDto(device.id)),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
