// NestJS
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';

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
import { UpdateDeviceInputDto } from '../../application/dto/update-device-input.dto';

// Use case
import { UpdateDeviceUseCase } from '../../application/use-cases/update-device.use-case';

describe('UpdateDeviceUseCase', () => {
  let useCase: UpdateDeviceUseCase;

  const deviceRepoMock = {
    findByIdAndCompanyId: jest.fn(),
    updateByIdAndCompanyId: jest.fn(),
  } as jest.Mocked<
    Pick<DeviceRepository, 'findByIdAndCompanyId' | 'updateByIdAndCompanyId'>
  >;

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
        UpdateDeviceUseCase,
        { provide: DEVICE_REPOSITORY, useValue: deviceRepoMock },
        { provide: ENTRANCE_REPOSITORY, useValue: entranceRepoMock },
      ],
    }).compile();
    useCase = module.get(UpdateDeviceUseCase);
  });

  it('atualiza nome/status mantendo o vínculo atual (entranceId não enviado)', async () => {
    deviceRepoMock.findByIdAndCompanyId.mockResolvedValue({
      ...device,
      entrance: null,
    });
    deviceRepoMock.updateByIdAndCompanyId.mockResolvedValue({
      ...device,
      name: 'Tablet Portaria 2',
      isActive: false,
    });

    const result = await useCase.execute(
      actor,
      new UpdateDeviceInputDto(
        device.id,
        'Tablet Portaria 2',
        undefined,
        false,
      ),
    );

    expect(deviceRepoMock.updateByIdAndCompanyId).toHaveBeenCalledWith(
      device.id,
      actor.companyId,
      { name: 'Tablet Portaria 2', entranceId: undefined, isActive: false },
    );
    expect(entranceRepoMock.findByIdAndCompanyId).not.toHaveBeenCalled();
    expect(result).toMatchObject({
      id: device.id,
      name: 'Tablet Portaria 2',
      entrance: null,
      isActive: false,
    });
  });

  it('vincula uma portaria ativa e agrega o resumo na resposta', async () => {
    deviceRepoMock.findByIdAndCompanyId.mockResolvedValue({
      ...device,
      entrance: null,
    });
    entranceRepoMock.findByIdAndCompanyId.mockResolvedValue(entrance);
    deviceRepoMock.updateByIdAndCompanyId.mockResolvedValue({
      ...device,
      entranceId: entrance.id,
    });

    const result = await useCase.execute(
      actor,
      new UpdateDeviceInputDto(device.id, undefined, entrance.id),
    );

    expect(entranceRepoMock.findByIdAndCompanyId).toHaveBeenCalledWith(
      entrance.id,
      actor.companyId,
    );
    expect(deviceRepoMock.updateByIdAndCompanyId).toHaveBeenCalledWith(
      device.id,
      actor.companyId,
      { name: undefined, entranceId: entrance.id, isActive: undefined },
    );
    expect(result.entrance).toEqual({ id: entrance.id, name: entrance.name });
  });

  it('desvincula a portaria com entranceId = null', async () => {
    deviceRepoMock.findByIdAndCompanyId.mockResolvedValue({
      ...device,
      entranceId: entrance.id,
      entrance: { id: entrance.id, name: entrance.name },
    });
    deviceRepoMock.updateByIdAndCompanyId.mockResolvedValue({
      ...device,
      entranceId: null,
    });

    const result = await useCase.execute(
      actor,
      new UpdateDeviceInputDto(device.id, undefined, null),
    );

    expect(deviceRepoMock.updateByIdAndCompanyId).toHaveBeenCalledWith(
      device.id,
      actor.companyId,
      { name: undefined, entranceId: null, isActive: undefined },
    );
    expect(entranceRepoMock.findByIdAndCompanyId).not.toHaveBeenCalled();
    expect(result.entrance).toBeNull();
  });

  it('lança NotFoundException quando o dispositivo não existe na empresa', async () => {
    deviceRepoMock.findByIdAndCompanyId.mockResolvedValue(null);

    await expect(
      useCase.execute(actor, new UpdateDeviceInputDto(device.id, 'Novo Nome')),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('lança BadRequestException quando a portaria vinculada está inativa', async () => {
    deviceRepoMock.findByIdAndCompanyId.mockResolvedValue({
      ...device,
      entrance: null,
    });
    entranceRepoMock.findByIdAndCompanyId.mockResolvedValue({
      ...entrance,
      isActive: false,
    });

    await expect(
      useCase.execute(
        actor,
        new UpdateDeviceInputDto(device.id, undefined, entrance.id),
      ),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(deviceRepoMock.updateByIdAndCompanyId).not.toHaveBeenCalled();
  });
});
