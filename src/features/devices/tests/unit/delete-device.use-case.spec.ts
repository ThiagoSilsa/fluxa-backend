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
import type { DeviceEntity } from '../../domain/entities/device.entity';
import type { DeviceRepository } from '../../domain/repositories/device.repository';

// Repository
import { DEVICE_REPOSITORY } from '../../domain/repositories/device.repository';

// DTO
import { GetDeviceInputDto } from '../../application/dto/get-device-input.dto';

// Use case
import { DeleteDeviceUseCase } from '../../application/use-cases/delete-device.use-case';

describe('DeleteDeviceUseCase', () => {
  let useCase: DeleteDeviceUseCase;

  const deviceRepoMock = {
    findByIdAndCompanyId: jest.fn(),
    deleteByIdAndCompanyId: jest.fn(),
  } as jest.Mocked<
    Pick<DeviceRepository, 'findByIdAndCompanyId' | 'deleteByIdAndCompanyId'>
  >;

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

  beforeEach(async () => {
    jest.clearAllMocks();
    const module = await Test.createTestingModule({
      providers: [
        DeleteDeviceUseCase,
        { provide: DEVICE_REPOSITORY, useValue: deviceRepoMock },
      ],
    }).compile();
    useCase = module.get(DeleteDeviceUseCase);
  });

  it('exclui fisicamente o dispositivo da empresa da sessão', async () => {
    deviceRepoMock.findByIdAndCompanyId.mockResolvedValue({
      ...device,
      entrance: null,
    });
    deviceRepoMock.deleteByIdAndCompanyId.mockResolvedValue(device);

    await useCase.execute(actor, new GetDeviceInputDto(device.id));

    expect(deviceRepoMock.deleteByIdAndCompanyId).toHaveBeenCalledWith(
      device.id,
      actor.companyId,
    );
  });

  it('lança NotFoundException quando o dispositivo não existe na empresa', async () => {
    deviceRepoMock.findByIdAndCompanyId.mockResolvedValue(null);

    await expect(
      useCase.execute(actor, new GetDeviceInputDto(device.id)),
    ).rejects.toBeInstanceOf(NotFoundException);

    expect(deviceRepoMock.deleteByIdAndCompanyId).not.toHaveBeenCalled();
  });

  it('lança NotFoundException se a exclusão não encontrar a linha', async () => {
    deviceRepoMock.findByIdAndCompanyId.mockResolvedValue({
      ...device,
      entrance: null,
    });
    deviceRepoMock.deleteByIdAndCompanyId.mockResolvedValue(null);

    await expect(
      useCase.execute(actor, new GetDeviceInputDto(device.id)),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
