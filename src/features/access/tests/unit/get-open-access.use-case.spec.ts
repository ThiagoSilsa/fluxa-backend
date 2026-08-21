// NestJS
import { BadRequestException } from '@nestjs/common';
import { Test } from '@nestjs/testing';

// Shared
import { PermissionCode } from '../../../../shared/constants/access-control.constant';

// Constants
import { UserType } from '../../../auth/domain/constants/user-type.constant';
import { AccessStatus } from '../../domain/constants/access.constant';

// Types
import type { AuthenticatedUserEntity } from '../../../auth/domain/entities/authenticated-user.entity';
import type { VehicleWithTypeEntity } from '../../../vehicles/domain/entities/vehicle.entity';
import type { VehicleAccessEntity } from '../../domain/entities/vehicle-access.entity';
import type { UserEntity } from '../../../users/domain/entities/user.entity';
import type { VehicleAccessRepository } from '../../domain/repositories/vehicle-access.repository';
import type { VehicleRepository } from '../../../vehicles/domain/repositories/vehicle.repository';
import type { UserRepository } from '../../../users/domain/repositories/user.repository';

// Repositories
import { VEHICLE_ACCESS_REPOSITORY } from '../../domain/repositories/vehicle-access.repository';
import { VEHICLE_REPOSITORY } from '../../../vehicles/domain/repositories/vehicle.repository';
import { USER_REPOSITORY } from '../../../users/domain/repositories/user.repository';

// DTOs
import { GetOpenAccessInputDto } from '../../application/dto/get-open-access-input.dto';

// Use case
import { GetOpenAccessUseCase } from '../../application/use-cases/get-open-access.use-case';

describe('GetOpenAccessUseCase', () => {
  let useCase: GetOpenAccessUseCase;

  const accessRepoMock = {
    findOpenByVehicleIdAndCompanyId: jest.fn(),
    findOpenByTemporaryPlateAndCompanyId: jest.fn(),
  } as jest.Mocked<
    Pick<
      VehicleAccessRepository,
      'findOpenByVehicleIdAndCompanyId' | 'findOpenByTemporaryPlateAndCompanyId'
    >
  >;

  const vehicleRepoMock = {
    findByPlateAndCompanyId: jest.fn(),
  } as jest.Mocked<Pick<VehicleRepository, 'findByPlateAndCompanyId'>>;

  const userRepoMock = {
    findById: jest.fn(),
  } as jest.Mocked<Pick<UserRepository, 'findById'>>;

  const actor: AuthenticatedUserEntity = {
    id: '30000000-0000-0000-0000-000000000002',
    companyId: '10000000-0000-0000-0000-000000000001',
    email: 'porteiro@somar.local',
    name: 'Porteiro Silva',
    type: UserType.EMPLOYEE,
    isAdmin: false,
    roleCodes: ['Portaria'],
    permissions: [PermissionCode.REGISTER_EXIT],
  };

  const vehicle: VehicleWithTypeEntity = {
    id: '40000000-0000-0000-0000-000000000010',
    plate: 'ABC1D23',
    companyId: actor.companyId,
    model: null,
    color: null,
    observation: null,
    isBlocked: false,
    freePass: false,
    vehicleTypeId: '40000000-0000-0000-0000-000000000001',
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    vehicleType: {
      id: '40000000-0000-0000-0000-000000000001',
      code: 'FROTA',
      name: 'Frota',
      isFleet: true,
    },
  };

  const driverUser: UserEntity = {
    id: '30000000-0000-0000-0000-000000000005',
    name: 'Motorista',
    email: 'motorista@somar.local',
    passwordHash: 'hash',
    phone: null,
    document: null,
    photoUrl: null,
    lastLoginAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const open: VehicleAccessEntity = {
    id: '70000000-0000-0000-0000-000000000001',
    companyId: actor.companyId,
    vehicleId: vehicle.id,
    temporaryPlate: null,
    driverUserId: driverUser.id,
    temporaryDriverName: null,
    departmentId: null,
    accessRequestId: null,
    overCapacity: false,
    status: AccessStatus.INSIDE,
    forcedExit: false,
    entryAt: new Date('2026-08-24T10:00:00Z'),
    exitAt: null,
    closedBy: null,
    closedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module = await Test.createTestingModule({
      providers: [
        GetOpenAccessUseCase,
        { provide: VEHICLE_ACCESS_REPOSITORY, useValue: accessRepoMock },
        { provide: VEHICLE_REPOSITORY, useValue: vehicleRepoMock },
        { provide: USER_REPOSITORY, useValue: userRepoMock },
      ],
    }).compile();
    useCase = module.get(GetOpenAccessUseCase);
  });

  it('devolve o acesso aberto com o condutor resolvido (conferência na saída)', async () => {
    vehicleRepoMock.findByPlateAndCompanyId.mockResolvedValue(vehicle);
    accessRepoMock.findOpenByVehicleIdAndCompanyId.mockResolvedValue([open]);
    accessRepoMock.findOpenByTemporaryPlateAndCompanyId.mockResolvedValue([]);
    userRepoMock.findById.mockResolvedValue(driverUser);

    const result = await useCase.execute(
      actor,
      new GetOpenAccessInputDto('ABC1D23'),
    );

    expect(vehicleRepoMock.findByPlateAndCompanyId).toHaveBeenCalledWith(
      'ABC1D23',
      actor.companyId,
    );
    expect(result.data).toHaveLength(1);
    expect(result.data[0]).toMatchObject({
      id: open.id,
      vehicleId: vehicle.id,
      driver: { id: driverUser.id, name: driverUser.name },
      entryAt: '2026-08-24T10:00:00.000Z',
    });
  });

  it('resolve condutor temporário pelo nome', async () => {
    vehicleRepoMock.findByPlateAndCompanyId.mockResolvedValue(null);
    accessRepoMock.findOpenByVehicleIdAndCompanyId.mockResolvedValue([]);
    accessRepoMock.findOpenByTemporaryPlateAndCompanyId.mockResolvedValue([
      {
        ...open,
        id: '70000000-0000-0000-0000-000000000002',
        vehicleId: null,
        temporaryPlate: 'XYZ9A99',
        driverUserId: null,
        temporaryDriverName: 'Visitante',
      },
    ]);

    const result = await useCase.execute(
      actor,
      new GetOpenAccessInputDto('XYZ9A99'),
    );

    expect(result.data[0]).toMatchObject({
      vehicleId: null,
      temporaryPlate: 'XYZ9A99',
      driver: { id: null, name: 'Visitante' },
    });
  });

  it('lança 400 para placa inválida', async () => {
    await expect(
      useCase.execute(actor, new GetOpenAccessInputDto('ABC12')),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
