// NestJS
import { ConflictException, NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { QueryFailedError } from 'typeorm';

// Shared
import { PermissionCode } from '../../../../shared/constants/access-control.constant';

// Constants
import { UserType } from '../../../auth/domain/constants/user-type.constant';

// Types
import type { AuthenticatedUserEntity } from '../../../auth/domain/entities/authenticated-user.entity';
import type { UserVehicleWithUserEntity } from '../../domain/entities/user-vehicle.entity';
import type { VehicleWithTypeEntity } from '../../domain/entities/vehicle.entity';
import type { UserVehicleRepository } from '../../domain/repositories/user-vehicle.repository';
import type { VehicleRepository } from '../../domain/repositories/vehicle.repository';

// Repositories
import { USER_VEHICLE_REPOSITORY } from '../../domain/repositories/user-vehicle.repository';
import { VEHICLE_REPOSITORY } from '../../domain/repositories/vehicle.repository';

// DTO
import { UpdateDriverInputDto } from '../../application/dto/update-driver-input.dto';

// Use case
import { UpdateVehicleDriverUseCase } from '../../application/use-cases/update-vehicle-driver.use-case';

describe('UpdateVehicleDriverUseCase', () => {
  let useCase: UpdateVehicleDriverUseCase;

  const vehicleRepoMock = {
    findByIdAndCompanyId: jest.fn(),
  } as jest.Mocked<Pick<VehicleRepository, 'findByIdAndCompanyId'>>;

  const userVehicleRepoMock = {
    findByUserIdAndVehicleIdAndCompanyId: jest.fn(),
    updateByIdAndCompanyId: jest.fn(),
  } as jest.Mocked<
    Pick<
      UserVehicleRepository,
      'findByUserIdAndVehicleIdAndCompanyId' | 'updateByIdAndCompanyId'
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
    permissions: [PermissionCode.MANAGE_VEHICLES],
  };

  const vehicleId = '50000000-0000-0000-0000-000000000001';
  const userId = '30000000-0000-0000-0000-000000000002';

  const vehicle: VehicleWithTypeEntity = {
    id: vehicleId,
    plate: 'ABC1D23',
    companyId: actor.companyId,
    model: null,
    color: null,
    observation: null,
    isBlocked: false,
    freePass: false,
    vehicleTypeId: '40000000-0000-0000-0000-000000000001',
    vehicleType: null,
    isActive: true,
    createdAt: new Date('2026-08-15T00:00:00Z'),
    updatedAt: new Date('2026-08-15T00:00:00Z'),
  };

  const link: UserVehicleWithUserEntity = {
    id: '60000000-0000-0000-0000-000000000001',
    companyId: actor.companyId,
    userId,
    vehicleId,
    isPrimary: false,
    canDrive: true,
    createdAt: new Date('2026-08-15T00:00:00Z'),
    updatedAt: new Date('2026-08-15T00:00:00Z'),
    user: { id: userId, name: 'Motorista' },
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module = await Test.createTestingModule({
      providers: [
        UpdateVehicleDriverUseCase,
        { provide: VEHICLE_REPOSITORY, useValue: vehicleRepoMock },
        { provide: USER_VEHICLE_REPOSITORY, useValue: userVehicleRepoMock },
      ],
    }).compile();
    useCase = module.get(UpdateVehicleDriverUseCase);
  });

  it('ajusta can_drive/is_primary sem remover+recriar', async () => {
    vehicleRepoMock.findByIdAndCompanyId.mockResolvedValue(vehicle);
    userVehicleRepoMock.findByUserIdAndVehicleIdAndCompanyId
      .mockResolvedValueOnce(link)
      .mockResolvedValueOnce({ ...link, canDrive: false });
    userVehicleRepoMock.updateByIdAndCompanyId.mockResolvedValue({
      ...link,
      canDrive: false,
    });

    const result = await useCase.execute(
      actor,
      new UpdateDriverInputDto(vehicleId, userId, undefined, false),
    );

    expect(userVehicleRepoMock.updateByIdAndCompanyId).toHaveBeenCalledWith(
      link.id,
      actor.companyId,
      { isPrimary: undefined, canDrive: false },
    );
    expect(result).toMatchObject({ canDrive: false, user: { id: userId } });
  });

  it('lança NotFoundException quando o veículo não existe na empresa', async () => {
    vehicleRepoMock.findByIdAndCompanyId.mockResolvedValue(null);

    await expect(
      useCase.execute(actor, new UpdateDriverInputDto(vehicleId, userId)),
    ).rejects.toThrow(NotFoundException);
  });

  it('lança NotFoundException quando o motorista não está vinculado', async () => {
    vehicleRepoMock.findByIdAndCompanyId.mockResolvedValue(vehicle);
    userVehicleRepoMock.findByUserIdAndVehicleIdAndCompanyId.mockResolvedValue(
      null,
    );

    await expect(
      useCase.execute(actor, new UpdateDriverInputDto(vehicleId, userId)),
    ).rejects.toThrow(NotFoundException);
    expect(userVehicleRepoMock.updateByIdAndCompanyId).not.toHaveBeenCalled();
  });

  it('traduz violação do unique parcial de primário em ConflictException (409)', async () => {
    vehicleRepoMock.findByIdAndCompanyId.mockResolvedValue(vehicle);
    userVehicleRepoMock.findByUserIdAndVehicleIdAndCompanyId
      .mockResolvedValueOnce(link)
      .mockResolvedValueOnce({ ...link, isPrimary: true });
    userVehicleRepoMock.updateByIdAndCompanyId.mockRejectedValue(
      new QueryFailedError('duplicate', [], new Error('23505')),
    );

    await expect(
      useCase.execute(actor, new UpdateDriverInputDto(vehicleId, userId, true)),
    ).rejects.toThrow(ConflictException);
  });
});
