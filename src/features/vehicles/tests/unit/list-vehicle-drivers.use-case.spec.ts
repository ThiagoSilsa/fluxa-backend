// NestJS
import { NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';

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
import { ListVehicleDriversInputDto } from '../../application/dto/list-vehicle-drivers-input.dto';

// Use case
import { ListVehicleDriversUseCase } from '../../application/use-cases/list-vehicle-drivers.use-case';

describe('ListVehicleDriversUseCase', () => {
  let useCase: ListVehicleDriversUseCase;

  const vehicleRepoMock = {
    findByIdAndCompanyId: jest.fn(),
  } as jest.Mocked<Pick<VehicleRepository, 'findByIdAndCompanyId'>>;

  const userVehicleRepoMock = {
    findByVehicleIdAndCompanyId: jest.fn(),
  } as jest.Mocked<Pick<UserVehicleRepository, 'findByVehicleIdAndCompanyId'>>;

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

  const drivers: UserVehicleWithUserEntity[] = [
    {
      id: '60000000-0000-0000-0000-000000000001',
      companyId: actor.companyId,
      userId: '30000000-0000-0000-0000-000000000002',
      vehicleId,
      isPrimary: true,
      canDrive: true,
      createdAt: new Date('2026-08-15T00:00:00Z'),
      updatedAt: new Date('2026-08-15T00:00:00Z'),
      user: { id: '30000000-0000-0000-0000-000000000002', name: 'Motorista' },
    },
  ];

  beforeEach(async () => {
    jest.clearAllMocks();
    const module = await Test.createTestingModule({
      providers: [
        ListVehicleDriversUseCase,
        { provide: VEHICLE_REPOSITORY, useValue: vehicleRepoMock },
        { provide: USER_VEHICLE_REPOSITORY, useValue: userVehicleRepoMock },
      ],
    }).compile();
    useCase = module.get(ListVehicleDriversUseCase);
  });

  it('lista os motoristas do veículo com nome, is_primary e can_drive', async () => {
    vehicleRepoMock.findByIdAndCompanyId.mockResolvedValue(vehicle);
    userVehicleRepoMock.findByVehicleIdAndCompanyId.mockResolvedValue(drivers);

    const result = await useCase.execute(
      actor,
      new ListVehicleDriversInputDto(vehicleId),
    );

    expect(
      userVehicleRepoMock.findByVehicleIdAndCompanyId,
    ).toHaveBeenCalledWith(vehicleId, actor.companyId);
    expect(result).toEqual({
      vehicleId,
      drivers: [
        {
          id: drivers[0].id,
          vehicleId,
          user: { id: drivers[0].userId, name: 'Motorista' },
          isPrimary: true,
          canDrive: true,
        },
      ],
    });
  });

  it('lança NotFoundException quando o veículo não existe na empresa', async () => {
    vehicleRepoMock.findByIdAndCompanyId.mockResolvedValue(null);

    await expect(
      useCase.execute(actor, new ListVehicleDriversInputDto(vehicleId)),
    ).rejects.toThrow(NotFoundException);
  });
});
