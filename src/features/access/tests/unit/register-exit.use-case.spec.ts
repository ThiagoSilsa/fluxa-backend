// NestJS
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';

// Shared
import { PermissionCode } from '../../../../shared/constants/access-control.constant';

// Constants
import { UserType } from '../../../auth/domain/constants/user-type.constant';
import {
  AccessStatus,
  MovementSource,
  MovementType,
  SyncStatus,
} from '../../domain/constants/access.constant';

// Types
import type { AuthenticatedUserEntity } from '../../../auth/domain/entities/authenticated-user.entity';
import type { VehicleWithTypeEntity } from '../../../vehicles/domain/entities/vehicle.entity';
import type { VehicleAccessEntity } from '../../domain/entities/vehicle-access.entity';
import type { VehicleMovementEntity } from '../../domain/entities/vehicle-movement.entity';
import type { UserEntity } from '../../../users/domain/entities/user.entity';
import type { VehicleAccessRepository } from '../../domain/repositories/vehicle-access.repository';
import type { VehicleRepository } from '../../../vehicles/domain/repositories/vehicle.repository';
import type { UserRepository } from '../../../users/domain/repositories/user.repository';
import type { EntranceRepository } from '../../../entrances/domain/repositories/entrance.repository';
import type { EntranceEntity } from '../../../entrances/domain/entities/entrance.entity';

// Repositories
import { VEHICLE_ACCESS_REPOSITORY } from '../../domain/repositories/vehicle-access.repository';
import { VEHICLE_REPOSITORY } from '../../../vehicles/domain/repositories/vehicle.repository';
import { USER_REPOSITORY } from '../../../users/domain/repositories/user.repository';
import { ENTRANCE_REPOSITORY } from '../../../entrances/domain/repositories/entrance.repository';

// DTOs
import { RegisterExitInputDto } from '../../application/dto/register-exit-input.dto';

// Use case
import { RegisterExitUseCase } from '../../application/use-cases/register-exit.use-case';

describe('RegisterExitUseCase', () => {
  let useCase: RegisterExitUseCase;

  const accessRepoMock = {
    findOpenByVehicleIdAndCompanyId: jest.fn(),
    findOpenByTemporaryPlateAndCompanyId: jest.fn(),
    closeOpenAndCreateExitMovements: jest.fn(),
    createNoExit: jest.fn(),
    findMovementByIdempotencyKeyAndCompanyId: jest.fn(),
    findByIdAndCompanyId: jest.fn(),
  } as jest.Mocked<
    Pick<
      VehicleAccessRepository,
      | 'findOpenByVehicleIdAndCompanyId'
      | 'findOpenByTemporaryPlateAndCompanyId'
      | 'closeOpenAndCreateExitMovements'
      | 'createNoExit'
      | 'findMovementByIdempotencyKeyAndCompanyId'
      | 'findByIdAndCompanyId'
    >
  >;

  const vehicleRepoMock = {
    findByPlateAndCompanyId: jest.fn(),
  } as jest.Mocked<Pick<VehicleRepository, 'findByPlateAndCompanyId'>>;

  const userRepoMock = {
    findById: jest.fn(),
  } as jest.Mocked<Pick<UserRepository, 'findById'>>;

  const entranceRepoMock = {
    findByIdAndCompanyId: jest.fn(),
  } as jest.Mocked<Pick<EntranceRepository, 'findByIdAndCompanyId'>>;

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

  const entrance: EntranceEntity = {
    id: '40000000-0000-0000-0000-000000000030',
    companyId: actor.companyId,
    name: 'Portaria Principal',
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
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

  const open: VehicleAccessEntity = {
    id: '70000000-0000-0000-0000-000000000001',
    companyId: actor.companyId,
    vehicleId: vehicle.id,
    temporaryPlate: null,
    driverUserId: '30000000-0000-0000-0000-000000000005',
    temporaryDriverName: null,
    departmentId: null,
    accessRequestId: null,
    overCapacity: false,
    status: AccessStatus.INSIDE,
    forcedExit: false,
    entryAt: new Date(),
    exitAt: null,
    closedBy: null,
    closedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const exitMovement: VehicleMovementEntity = {
    id: '70000000-0000-0000-0000-000000000002',
    companyId: actor.companyId,
    accessId: open.id,
    vehicleId: vehicle.id,
    type: MovementType.EXIT,
    occurredAt: new Date(),
    plateSnapshot: 'ABC1D23',
    driverUserId: open.driverUserId,
    departmentId: null,
    source: MovementSource.PLATE,
    entranceId: null,
    doormanId: actor.id,
    syncStatus: SyncStatus.SYNCED,
    idempotencyKey: 'mov-1',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module = await Test.createTestingModule({
      providers: [
        RegisterExitUseCase,
        { provide: VEHICLE_ACCESS_REPOSITORY, useValue: accessRepoMock },
        { provide: VEHICLE_REPOSITORY, useValue: vehicleRepoMock },
        { provide: USER_REPOSITORY, useValue: userRepoMock },
        { provide: ENTRANCE_REPOSITORY, useValue: entranceRepoMock },
      ],
    }).compile();
    useCase = module.get(RegisterExitUseCase);
  });

  it('encerra todos os INSIDE abertos do veículo (regra 10)', async () => {
    vehicleRepoMock.findByPlateAndCompanyId.mockResolvedValue(vehicle);
    accessRepoMock.findOpenByVehicleIdAndCompanyId.mockResolvedValue([open]);
    accessRepoMock.findOpenByTemporaryPlateAndCompanyId.mockResolvedValue([]);
    accessRepoMock.closeOpenAndCreateExitMovements.mockResolvedValue([
      {
        access: {
          ...open,
          status: AccessStatus.OUT,
          exitAt: new Date(),
          closedBy: actor.id,
        },
        movement: exitMovement,
      },
    ]);

    const result = await useCase.execute(
      actor,
      new RegisterExitInputDto('ABC1D23'),
    );

    expect(accessRepoMock.closeOpenAndCreateExitMovements).toHaveBeenCalledWith(
      expect.objectContaining({
        companyId: actor.companyId,
        accessIds: [open.id],
        plateSnapshot: 'ABC1D23',
        source: MovementSource.PLATE,
        doormanId: actor.id,
        syncStatus: SyncStatus.SYNCED,
      }),
    );
    expect(result.closedAccesses).toHaveLength(1);
    expect(result.closedAccesses[0].movement.type).toBe(MovementType.EXIT);
    expect(result.noExit).toBeNull();
  });

  it('registra NO_EXIT com passageiro quando não há entrada (regra 11)', async () => {
    vehicleRepoMock.findByPlateAndCompanyId.mockResolvedValue(vehicle);
    accessRepoMock.findOpenByVehicleIdAndCompanyId.mockResolvedValue([]);
    accessRepoMock.findOpenByTemporaryPlateAndCompanyId.mockResolvedValue([]);
    userRepoMock.findById.mockResolvedValue({
      id: '30000000-0000-0000-0000-000000000005',
      name: 'Motorista',
    } as UserEntity);
    accessRepoMock.createNoExit.mockResolvedValue({
      access: {
        ...open,
        id: '70000000-0000-0000-0000-000000000003',
        status: AccessStatus.NO_EXIT,
        exitAt: new Date(),
      },
      movement: exitMovement,
    });

    const result = await useCase.execute(
      actor,
      new RegisterExitInputDto(
        'ABC1D23',
        '30000000-0000-0000-0000-000000000005',
      ),
    );

    expect(accessRepoMock.createNoExit).toHaveBeenCalledWith(
      expect.objectContaining({
        companyId: actor.companyId,
        vehicleId: vehicle.id,
        temporaryPlate: null,
        driverUserId: '30000000-0000-0000-0000-000000000005',
        source: MovementSource.PLATE,
      }),
    );
    expect(result.closedAccesses).toEqual([]);
    expect(result.noExit?.access.status).toBe(AccessStatus.NO_EXIT);
  });

  it('lança 400 para NO_EXIT sem passageiro (veículo sem free_pass)', async () => {
    vehicleRepoMock.findByPlateAndCompanyId.mockResolvedValue(vehicle);
    accessRepoMock.findOpenByVehicleIdAndCompanyId.mockResolvedValue([]);
    accessRepoMock.findOpenByTemporaryPlateAndCompanyId.mockResolvedValue([]);

    await expect(
      useCase.execute(actor, new RegisterExitInputDto('ABC1D23')),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(accessRepoMock.createNoExit).not.toHaveBeenCalled();
  });

  it('registra NO_EXIT sem perguntar passageiro para free_pass', async () => {
    vehicleRepoMock.findByPlateAndCompanyId.mockResolvedValue({
      ...vehicle,
      freePass: true,
    });
    accessRepoMock.findOpenByVehicleIdAndCompanyId.mockResolvedValue([]);
    accessRepoMock.findOpenByTemporaryPlateAndCompanyId.mockResolvedValue([]);
    accessRepoMock.createNoExit.mockResolvedValue({
      access: {
        ...open,
        id: '70000000-0000-0000-0000-000000000004',
        status: AccessStatus.NO_EXIT,
      },
      movement: exitMovement,
    });

    const result = await useCase.execute(
      actor,
      new RegisterExitInputDto('ABC1D23'),
    );

    expect(result.noExit).not.toBeNull();
    expect(accessRepoMock.createNoExit).toHaveBeenCalledWith(
      expect.objectContaining({
        driverUserId: null,
        temporaryDriverName: null,
      }),
    );
  });

  it('lança 400 para placa inválida', async () => {
    await expect(
      useCase.execute(actor, new RegisterExitInputDto('ABC12')),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('lança 404 para passageiro inexistente (NO_EXIT)', async () => {
    vehicleRepoMock.findByPlateAndCompanyId.mockResolvedValue(vehicle);
    accessRepoMock.findOpenByVehicleIdAndCompanyId.mockResolvedValue([]);
    accessRepoMock.findOpenByTemporaryPlateAndCompanyId.mockResolvedValue([]);
    userRepoMock.findById.mockResolvedValue(null);

    await expect(
      useCase.execute(
        actor,
        new RegisterExitInputDto(
          'ABC1D23',
          '30000000-0000-0000-0000-000000000005',
        ),
      ),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('registra saída com source=QRCODE e portaria ativa (M4)', async () => {
    vehicleRepoMock.findByPlateAndCompanyId.mockResolvedValue(vehicle);
    accessRepoMock.findOpenByVehicleIdAndCompanyId.mockResolvedValue([open]);
    accessRepoMock.findOpenByTemporaryPlateAndCompanyId.mockResolvedValue([]);
    accessRepoMock.closeOpenAndCreateExitMovements.mockResolvedValue([
      {
        access: {
          ...open,
          status: AccessStatus.OUT,
          exitAt: new Date(),
          closedBy: actor.id,
        },
        movement: exitMovement,
      },
    ]);
    entranceRepoMock.findByIdAndCompanyId.mockResolvedValue(entrance);

    const result = await useCase.execute(
      actor,
      new RegisterExitInputDto(
        'ABC1D23',
        undefined,
        undefined,
        'exit-mov-1',
        MovementSource.QRCODE,
        entrance.id,
      ),
    );

    expect(entranceRepoMock.findByIdAndCompanyId).toHaveBeenCalledWith(
      entrance.id,
      actor.companyId,
    );
    expect(accessRepoMock.closeOpenAndCreateExitMovements).toHaveBeenCalledWith(
      expect.objectContaining({
        source: MovementSource.QRCODE,
        entranceId: entrance.id,
        idempotencyKey: 'exit-mov-1',
      }),
    );
    expect(result.closedAccesses).toHaveLength(1);
  });

  it('lança 400 para source interno (WEB) (M4)', async () => {
    await expect(
      useCase.execute(
        actor,
        new RegisterExitInputDto(
          'ABC1D23',
          undefined,
          undefined,
          undefined,
          MovementSource.WEB,
        ),
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(
      accessRepoMock.closeOpenAndCreateExitMovements,
    ).not.toHaveBeenCalled();
  });

  it('lança 404 para portaria inexistente (M4)', async () => {
    entranceRepoMock.findByIdAndCompanyId.mockResolvedValue(null);

    await expect(
      useCase.execute(
        actor,
        new RegisterExitInputDto(
          'ABC1D23',
          undefined,
          undefined,
          undefined,
          MovementSource.QRCODE,
          '40000000-0000-0000-0000-000000000099',
        ),
      ),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('lança 400 para portaria inativa (M4)', async () => {
    entranceRepoMock.findByIdAndCompanyId.mockResolvedValue({
      ...entrance,
      isActive: false,
    });

    await expect(
      useCase.execute(
        actor,
        new RegisterExitInputDto(
          'ABC1D23',
          undefined,
          undefined,
          undefined,
          MovementSource.QRCODE,
          entrance.id,
        ),
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('dedup: saída já registrada devolve closedAccesses sem duplicar (M4)', async () => {
    accessRepoMock.findMovementByIdempotencyKeyAndCompanyId.mockResolvedValue(
      exitMovement,
    );
    accessRepoMock.findByIdAndCompanyId.mockResolvedValue({
      ...open,
      status: AccessStatus.OUT,
      exitAt: new Date(),
      closedBy: actor.id,
    });

    const result = await useCase.execute(
      actor,
      new RegisterExitInputDto('ABC1D23', undefined, undefined, 'exit-mov-1'),
    );

    expect(result.closedAccesses).toHaveLength(1);
    expect(result.closedAccesses[0].access.id).toBe(open.id);
    expect(result.closedAccesses[0].movement.id).toBe(exitMovement.id);
    expect(result.noExit).toBeNull();
    expect(
      accessRepoMock.closeOpenAndCreateExitMovements,
    ).not.toHaveBeenCalled();
    expect(accessRepoMock.createNoExit).not.toHaveBeenCalled();
  });

  it('dedup: NO_EXIT já registrado devolve noExit sem duplicar (M4)', async () => {
    accessRepoMock.findMovementByIdempotencyKeyAndCompanyId.mockResolvedValue(
      exitMovement,
    );
    accessRepoMock.findByIdAndCompanyId.mockResolvedValue({
      ...open,
      status: AccessStatus.NO_EXIT,
      exitAt: new Date(),
      closedBy: actor.id,
    });

    const result = await useCase.execute(
      actor,
      new RegisterExitInputDto(
        'ABC1D23',
        undefined,
        undefined,
        'exit-nov-exit',
      ),
    );

    expect(result.closedAccesses).toEqual([]);
    expect(result.noExit?.access.status).toBe(AccessStatus.NO_EXIT);
    expect(accessRepoMock.createNoExit).not.toHaveBeenCalled();
  });
});
