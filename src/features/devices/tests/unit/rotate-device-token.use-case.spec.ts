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
import { RotateDeviceTokenUseCase } from '../../application/use-cases/rotate-device-token.use-case';

describe('RotateDeviceTokenUseCase', () => {
  let useCase: RotateDeviceTokenUseCase;

  const deviceRepoMock = {
    findByIdAndCompanyId: jest.fn(),
    rotateTokenByIdAndCompanyId: jest.fn(),
  } as jest.Mocked<
    Pick<
      DeviceRepository,
      'findByIdAndCompanyId' | 'rotateTokenByIdAndCompanyId'
    >
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
        RotateDeviceTokenUseCase,
        { provide: DEVICE_REPOSITORY, useValue: deviceRepoMock },
      ],
    }).compile();
    useCase = module.get(RotateDeviceTokenUseCase);
  });

  it('rotaciona o token e devolve o novo token uma única vez', async () => {
    deviceRepoMock.findByIdAndCompanyId.mockResolvedValue({
      ...device,
      entrance: null,
    });
    deviceRepoMock.rotateTokenByIdAndCompanyId.mockResolvedValue(device);

    const result = await useCase.execute(
      actor,
      new GetDeviceInputDto(device.id),
    );

    expect(deviceRepoMock.rotateTokenByIdAndCompanyId).toHaveBeenCalledWith(
      device.id,
      actor.companyId,
      expect.stringMatching(/^[0-9a-f]{32}$/),
    );
    expect(result.token).toMatch(/^[0-9a-f]{32}$/);
    // O novo token nunca aparece dentro de `device` (write-only — ADR 0008 §3).
    expect(result.device).not.toHaveProperty('token');
    expect(result.device).toMatchObject({ id: device.id, entrance: null });
  });

  it('mantém o resumo da portaria atual na resposta', async () => {
    deviceRepoMock.findByIdAndCompanyId.mockResolvedValue({
      ...device,
      entranceId: '40000000-0000-0000-0000-000000000002',
      entrance: {
        id: '40000000-0000-0000-0000-000000000002',
        name: 'Portaria Principal',
      },
    });
    deviceRepoMock.rotateTokenByIdAndCompanyId.mockResolvedValue({
      ...device,
      entranceId: '40000000-0000-0000-0000-000000000002',
    });

    const result = await useCase.execute(
      actor,
      new GetDeviceInputDto(device.id),
    );

    expect(result.device.entrance).toEqual({
      id: '40000000-0000-0000-0000-000000000002',
      name: 'Portaria Principal',
    });
  });

  it('lança NotFoundException quando o dispositivo não existe na empresa', async () => {
    deviceRepoMock.findByIdAndCompanyId.mockResolvedValue(null);

    await expect(
      useCase.execute(actor, new GetDeviceInputDto(device.id)),
    ).rejects.toBeInstanceOf(NotFoundException);

    expect(deviceRepoMock.rotateTokenByIdAndCompanyId).not.toHaveBeenCalled();
  });
});
