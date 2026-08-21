// NestJS
import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';

// TypeORM
import { QueryFailedError } from 'typeorm';

// Shared
import { PermissionCode } from '../../../../shared/constants/access-control.constant';

// Constants
import { UserType } from '../../../auth/domain/constants/user-type.constant';
import { DevicePlatform } from '../../domain/constants/device-platform.constant';

// Types
import type { AuthenticatedUserEntity } from '../../../auth/domain/entities/authenticated-user.entity';
import type { EntranceEntity } from '../../../entrances/domain/entities/entrance.entity';
import type { DeviceEntity } from '../../domain/entities/device.entity';
import type { DeviceRepository } from '../../domain/repositories/device.repository';
import type { EntranceRepository } from '../../../entrances/domain/repositories/entrance.repository';

// Repositories
import { DEVICE_REPOSITORY } from '../../domain/repositories/device.repository';
import { ENTRANCE_REPOSITORY } from '../../../entrances/domain/repositories/entrance.repository';

// DTO
import { CreateDeviceInputDto } from '../../application/dto/create-device-input.dto';

// Use case
import { CreateDeviceUseCase } from '../../application/use-cases/create-device.use-case';

describe('CreateDeviceUseCase', () => {
  let useCase: CreateDeviceUseCase;

  const deviceRepoMock = {
    create: jest.fn(),
  } as jest.Mocked<Pick<DeviceRepository, 'create'>>;

  const entranceRepoMock = {
    findByIdAndCompanyId: jest.fn(),
  } as jest.Mocked<Pick<EntranceRepository, 'findByIdAndCompanyId'>>;

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

  const createdDevice: DeviceEntity = {
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
        CreateDeviceUseCase,
        { provide: DEVICE_REPOSITORY, useValue: deviceRepoMock },
        { provide: ENTRANCE_REPOSITORY, useValue: entranceRepoMock },
      ],
    }).compile();
    useCase = module.get(CreateDeviceUseCase);
  });

  it('cria o dispositivo na empresa da sessão e devolve o token (32 hex)', async () => {
    deviceRepoMock.create.mockResolvedValue(createdDevice);

    const result = await useCase.execute(
      actor,
      new CreateDeviceInputDto('Tablet Portaria 1', DevicePlatform.ANDROID),
    );

    expect(entranceRepoMock.findByIdAndCompanyId).not.toHaveBeenCalled();
    expect(deviceRepoMock.create).toHaveBeenCalledWith({
      companyId: actor.companyId,
      name: 'Tablet Portaria 1',
      platform: DevicePlatform.ANDROID,
      token: expect.stringMatching(/^[0-9a-f]{32}$/),
      entranceId: undefined,
    });
    expect(result.device).toMatchObject({
      id: createdDevice.id,
      name: 'Tablet Portaria 1',
      platform: DevicePlatform.ANDROID,
      entrance: null,
      isActive: true,
    });
    // O token nunca aparece dentro de `device` (write-only — ADR 0008 §3).
    expect(result.device).not.toHaveProperty('token');
    expect(result.token).toMatch(/^[0-9a-f]{32}$/);
  });

  it('valida a portaria ativa e agrega o resumo na resposta', async () => {
    entranceRepoMock.findByIdAndCompanyId.mockResolvedValue(entrance);
    deviceRepoMock.create.mockResolvedValue({
      ...createdDevice,
      entranceId: entrance.id,
    });

    const result = await useCase.execute(
      actor,
      new CreateDeviceInputDto(
        'Tablet Portaria 1',
        DevicePlatform.ANDROID,
        entrance.id,
      ),
    );

    expect(entranceRepoMock.findByIdAndCompanyId).toHaveBeenCalledWith(
      entrance.id,
      actor.companyId,
    );
    expect(result.device.entrance).toEqual({
      id: entrance.id,
      name: entrance.name,
    });
  });

  it('lança NotFoundException quando a portaria não existe na empresa', async () => {
    entranceRepoMock.findByIdAndCompanyId.mockResolvedValue(null);

    await expect(
      useCase.execute(
        actor,
        new CreateDeviceInputDto(
          'Tablet Portaria 1',
          DevicePlatform.ANDROID,
          entrance.id,
        ),
      ),
    ).rejects.toBeInstanceOf(NotFoundException);

    expect(deviceRepoMock.create).not.toHaveBeenCalled();
  });

  it('lança BadRequestException quando a portaria está inativa', async () => {
    entranceRepoMock.findByIdAndCompanyId.mockResolvedValue({
      ...entrance,
      isActive: false,
    });

    await expect(
      useCase.execute(
        actor,
        new CreateDeviceInputDto(
          'Tablet Portaria 1',
          DevicePlatform.ANDROID,
          entrance.id,
        ),
      ),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(deviceRepoMock.create).not.toHaveBeenCalled();
  });

  it('traduz colisão de unique do token para ConflictException', async () => {
    deviceRepoMock.create.mockRejectedValue(
      new QueryFailedError('', [], new Error('duplicate')),
    );

    await expect(
      useCase.execute(
        actor,
        new CreateDeviceInputDto('Tablet Portaria 1', DevicePlatform.ANDROID),
      ),
    ).rejects.toBeInstanceOf(ConflictException);
  });
});
