// NestJS
import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';

// Shared
import { PermissionCode } from '../../../../shared/constants/access-control.constant';

// Constants
import { UserType } from '../../../auth/domain/constants/user-type.constant';
import {
  EntryDenialReason,
  SyncStatus as BlockSyncStatus,
} from '../../../blocks/domain/constants/block.constant';
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
import type { VehicleBlockEntity } from '../../../blocks/domain/entities/vehicle-block.entity';
import type { EntryDenialEntity } from '../../../blocks/domain/entities/entry-denial.entity';
import type { AccessRequestEntity } from '../../../access-requests/domain/entities/access-request.entity';
import type { UserEntity } from '../../../users/domain/entities/user.entity';
import type { UserVehicleWithUserEntity } from '../../../vehicles/domain/entities/user-vehicle.entity';
import type { DepartmentEntity } from '../../../departments/domain/entities/department.entity';
import type { EntranceEntity } from '../../../entrances/domain/entities/entrance.entity';
import type { VehicleAccessRepository } from '../../domain/repositories/vehicle-access.repository';
import type { VehicleBlockRepository } from '../../../blocks/domain/repositories/vehicle-block.repository';
import type { EntryDenialRepository } from '../../../blocks/domain/repositories/entry-denial.repository';
import type { AccessRequestRepository } from '../../../access-requests/domain/repositories/access-request.repository';
import type { UserRepository } from '../../../users/domain/repositories/user.repository';
import type { UserVehicleRepository } from '../../../vehicles/domain/repositories/user-vehicle.repository';
import type { VehicleDepartmentRepository } from '../../../vehicles/domain/repositories/vehicle-department.repository';
import type { DepartmentRepository } from '../../../departments/domain/repositories/department.repository';
import type { VehicleRepository } from '../../../vehicles/domain/repositories/vehicle.repository';
import type { EntranceRepository } from '../../../entrances/domain/repositories/entrance.repository';

// Repositories
import { VEHICLE_ACCESS_REPOSITORY } from '../../domain/repositories/vehicle-access.repository';
import { VEHICLE_BLOCK_REPOSITORY } from '../../../blocks/domain/repositories/vehicle-block.repository';
import { ENTRY_DENIAL_REPOSITORY } from '../../../blocks/domain/repositories/entry-denial.repository';
import { ACCESS_REQUEST_REPOSITORY } from '../../../access-requests/domain/repositories/access-request.repository';
import { USER_REPOSITORY } from '../../../users/domain/repositories/user.repository';
import { USER_VEHICLE_REPOSITORY } from '../../../vehicles/domain/repositories/user-vehicle.repository';
import { VEHICLE_DEPARTMENT_REPOSITORY } from '../../../vehicles/domain/repositories/vehicle-department.repository';
import { DEPARTMENT_REPOSITORY } from '../../../departments/domain/repositories/department.repository';
import { VEHICLE_REPOSITORY } from '../../../vehicles/domain/repositories/vehicle.repository';
import { ENTRANCE_REPOSITORY } from '../../../entrances/domain/repositories/entrance.repository';

// DTOs
import { RegisterEntryInputDto } from '../../application/dto/register-entry-input.dto';

// Use case
import { RegisterEntryUseCase } from '../../application/use-cases/register-entry.use-case';

describe('RegisterEntryUseCase', () => {
  let useCase: RegisterEntryUseCase;

  const accessRepoMock = {
    createEntry: jest.fn(),
    countInsideByDepartmentIdAndCompanyId: jest.fn(),
    countInsideByCompanyId: jest.fn(),
    findMovementByIdempotencyKeyAndCompanyId: jest.fn(),
    findByIdAndCompanyId: jest.fn(),
  } as jest.Mocked<
    Pick<
      VehicleAccessRepository,
      | 'createEntry'
      | 'countInsideByDepartmentIdAndCompanyId'
      | 'countInsideByCompanyId'
      | 'findMovementByIdempotencyKeyAndCompanyId'
      | 'findByIdAndCompanyId'
    >
  >;

  const vehicleRepoMock = {
    findByPlateAndCompanyId: jest.fn(),
  } as jest.Mocked<Pick<VehicleRepository, 'findByPlateAndCompanyId'>>;

  const blockRepoMock = {
    findActiveByVehicleIdAndCompanyId: jest.fn(),
    findActiveByPlateAndCompanyId: jest.fn(),
  } as jest.Mocked<
    Pick<
      VehicleBlockRepository,
      'findActiveByVehicleIdAndCompanyId' | 'findActiveByPlateAndCompanyId'
    >
  >;

  const denialRepoMock = {
    create: jest.fn(),
  } as jest.Mocked<Pick<EntryDenialRepository, 'create'>>;

  const accessRequestRepoMock = {
    findByIdAndCompanyId: jest.fn(),
  } as jest.Mocked<Pick<AccessRequestRepository, 'findByIdAndCompanyId'>>;

  const userRepoMock = {
    findById: jest.fn(),
  } as jest.Mocked<Pick<UserRepository, 'findById'>>;

  const userVehicleRepoMock = {
    findByUserIdAndVehicleIdAndCompanyId: jest.fn(),
  } as jest.Mocked<
    Pick<UserVehicleRepository, 'findByUserIdAndVehicleIdAndCompanyId'>
  >;

  const vehicleDepartmentRepoMock = {
    findActiveByVehicleIdAndCompanyId: jest.fn(),
  } as jest.Mocked<
    Pick<VehicleDepartmentRepository, 'findActiveByVehicleIdAndCompanyId'>
  >;

  const departmentRepoMock = {
    findByIdAndCompanyId: jest.fn(),
    list: jest.fn(),
  } as jest.Mocked<Pick<DepartmentRepository, 'findByIdAndCompanyId' | 'list'>>;

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
    permissions: [PermissionCode.REGISTER_ENTRY],
  };

  const vehicleId = '40000000-0000-0000-0000-000000000010';
  const driverUserId = '30000000-0000-0000-0000-000000000005';
  const departmentId = '40000000-0000-0000-0000-000000000002';

  function buildVehicle(
    overrides: Partial<VehicleWithTypeEntity> = {},
  ): VehicleWithTypeEntity {
    return {
      id: vehicleId,
      plate: 'ABC1D23',
      companyId: actor.companyId,
      model: null,
      color: null,
      observation: null,
      isBlocked: false,
      freePass: false,
      vehicleTypeId: '40000000-0000-0000-0000-000000000001',
      isActive: true,
      createdAt: new Date('2026-08-21T00:00:00Z'),
      updatedAt: new Date('2026-08-21T00:00:00Z'),
      vehicleType: {
        id: '40000000-0000-0000-0000-000000000001',
        code: 'FROTA',
        name: 'Frota',
        isFleet: true,
      },
      ...overrides,
    };
  }

  const block: VehicleBlockEntity = {
    id: '50000000-0000-0000-0000-000000000001',
    companyId: actor.companyId,
    vehicleId,
    plate: 'ABC1D23',
    blockType: 'MANUAL' as never,
    reason: 'Furto suspeito',
    status: 'ACTIVE' as never,
    blockedBy: actor.id,
    blockedAt: new Date(),
    revokedBy: null,
    revokedAt: null,
    revokedReason: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const denial: EntryDenialEntity = {
    id: '50000000-0000-0000-0000-000000000010',
    companyId: actor.companyId,
    vehicleId,
    plateSnapshot: 'ABC1D23',
    blockId: block.id,
    reason: EntryDenialReason.BLOCKED,
    observation: 'Veículo bloqueado: Furto suspeito',
    entranceId: null,
    doormanId: actor.id,
    occurredAt: new Date(),
    syncStatus: BlockSyncStatus.SYNCED,
    idempotencyKey: 'denial-1',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const driverUser: UserEntity = {
    id: driverUserId,
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

  const link = {
    id: '60000000-0000-0000-0000-000000000001',
    companyId: actor.companyId,
    userId: driverUserId,
    vehicleId,
    isPrimary: true,
    canDrive: true,
    user: { id: driverUserId, name: 'Motorista' },
    createdAt: new Date(),
    updatedAt: new Date(),
  } as UserVehicleWithUserEntity;

  const department: DepartmentEntity = {
    id: departmentId,
    companyId: actor.companyId,
    name: 'Recepção',
    description: null,
    parkingSpace: 10,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const entrance: EntranceEntity = {
    id: '40000000-0000-0000-0000-000000000030',
    companyId: actor.companyId,
    name: 'Portaria Principal',
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const access: VehicleAccessEntity = {
    id: '70000000-0000-0000-0000-000000000001',
    companyId: actor.companyId,
    vehicleId,
    temporaryPlate: null,
    driverUserId,
    temporaryDriverName: null,
    departmentId,
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

  const movement: VehicleMovementEntity = {
    id: '70000000-0000-0000-0000-000000000002',
    companyId: actor.companyId,
    accessId: access.id,
    vehicleId,
    type: MovementType.ENTRY,
    occurredAt: new Date(),
    plateSnapshot: 'ABC1D23',
    driverUserId,
    departmentId,
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
    // O mock do impedimento reflete o motivo/vínculo passado ao create.
    denialRepoMock.create.mockImplementation((data) =>
      Promise.resolve({
        ...denial,
        vehicleId: data.vehicleId,
        blockId: data.blockId,
        reason: data.reason,
        observation: data.observation,
      }),
    );
    const module = await Test.createTestingModule({
      providers: [
        RegisterEntryUseCase,
        { provide: VEHICLE_ACCESS_REPOSITORY, useValue: accessRepoMock },
        { provide: VEHICLE_REPOSITORY, useValue: vehicleRepoMock },
        { provide: VEHICLE_BLOCK_REPOSITORY, useValue: blockRepoMock },
        { provide: ENTRY_DENIAL_REPOSITORY, useValue: denialRepoMock },
        { provide: ACCESS_REQUEST_REPOSITORY, useValue: accessRequestRepoMock },
        { provide: USER_REPOSITORY, useValue: userRepoMock },
        { provide: USER_VEHICLE_REPOSITORY, useValue: userVehicleRepoMock },
        {
          provide: VEHICLE_DEPARTMENT_REPOSITORY,
          useValue: vehicleDepartmentRepoMock,
        },
        { provide: DEPARTMENT_REPOSITORY, useValue: departmentRepoMock },
        { provide: ENTRANCE_REPOSITORY, useValue: entranceRepoMock },
      ],
    }).compile();
    useCase = module.get(RegisterEntryUseCase);
  });

  it('libera veículo free_pass sem condutor (regra 3)', async () => {
    vehicleRepoMock.findByPlateAndCompanyId.mockResolvedValue(
      buildVehicle({ freePass: true }),
    );
    blockRepoMock.findActiveByVehicleIdAndCompanyId.mockResolvedValue(null);
    accessRepoMock.countInsideByCompanyId.mockResolvedValue(0);
    departmentRepoMock.list.mockResolvedValue({ data: [], count: 0 });
    accessRepoMock.createEntry.mockResolvedValue({
      access,
      movement,
      previousClosed: null,
    });

    const result = await useCase.execute(
      actor,
      new RegisterEntryInputDto('ABC1D23'),
    );

    expect(result.granted).toBe(true);
    expect(accessRepoMock.createEntry).toHaveBeenCalledWith(
      expect.objectContaining({
        companyId: actor.companyId,
        vehicleId,
        temporaryPlate: null,
        driverUserId: null,
        temporaryDriverName: null,
        source: MovementSource.PLATE,
        entranceId: null,
        doormanId: actor.id,
        syncStatus: SyncStatus.SYNCED,
      }),
    );
    expect(result.access?.vehicleId).toBe(vehicleId);
  });

  it('libera veículo cadastrado com condutor can_drive (regra 4)', async () => {
    vehicleRepoMock.findByPlateAndCompanyId.mockResolvedValue(buildVehicle());
    blockRepoMock.findActiveByVehicleIdAndCompanyId.mockResolvedValue(null);
    userRepoMock.findById.mockResolvedValue(driverUser);
    userVehicleRepoMock.findByUserIdAndVehicleIdAndCompanyId.mockResolvedValue(
      link,
    );
    accessRepoMock.countInsideByCompanyId.mockResolvedValue(0);
    departmentRepoMock.list.mockResolvedValue({ data: [], count: 0 });
    accessRepoMock.createEntry.mockResolvedValue({
      access,
      movement,
      previousClosed: null,
    });

    const result = await useCase.execute(
      actor,
      new RegisterEntryInputDto('ABC1D23', driverUserId),
    );

    expect(result.granted).toBe(true);
    expect(accessRepoMock.createEntry).toHaveBeenCalledWith(
      expect.objectContaining({ driverUserId }),
    );
  });

  it('nega condutor sem can_drive (denial UNAUTHORIZED_DRIVER automático)', async () => {
    vehicleRepoMock.findByPlateAndCompanyId.mockResolvedValue(buildVehicle());
    blockRepoMock.findActiveByVehicleIdAndCompanyId.mockResolvedValue(null);
    userRepoMock.findById.mockResolvedValue(driverUser);
    userVehicleRepoMock.findByUserIdAndVehicleIdAndCompanyId.mockResolvedValue({
      ...link,
      canDrive: false,
    });

    const result = await useCase.execute(
      actor,
      new RegisterEntryInputDto('ABC1D23', driverUserId),
    );

    expect(result.granted).toBe(false);
    expect(result.denial?.reason).toBe(EntryDenialReason.UNAUTHORIZED_DRIVER);
    expect(denialRepoMock.create).toHaveBeenCalledWith(
      expect.objectContaining({
        plateSnapshot: 'ABC1D23',
        vehicleId,
        reason: EntryDenialReason.UNAUTHORIZED_DRIVER,
        doormanId: actor.id,
        syncStatus: BlockSyncStatus.SYNCED,
      }),
    );
    expect(accessRepoMock.createEntry).not.toHaveBeenCalled();
  });

  it('lança 400 para veículo cadastrado sem condutor (sem free_pass)', async () => {
    vehicleRepoMock.findByPlateAndCompanyId.mockResolvedValue(buildVehicle());
    blockRepoMock.findActiveByVehicleIdAndCompanyId.mockResolvedValue(null);

    await expect(
      useCase.execute(actor, new RegisterEntryInputDto('ABC1D23')),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(accessRepoMock.createEntry).not.toHaveBeenCalled();
  });

  it('nega veículo bloqueado (denial BLOCKED) sem criar entrada', async () => {
    vehicleRepoMock.findByPlateAndCompanyId.mockResolvedValue(buildVehicle());
    blockRepoMock.findActiveByVehicleIdAndCompanyId.mockResolvedValue(block);

    const result = await useCase.execute(
      actor,
      new RegisterEntryInputDto('ABC1D23', driverUserId),
    );

    expect(result.granted).toBe(false);
    expect(result.denial?.reason).toBe(EntryDenialReason.BLOCKED);
    expect(result.denial?.blockId).toBe(block.id);
    expect(accessRepoMock.createEntry).not.toHaveBeenCalled();
  });

  it('nega veículo inativo (denial OTHER)', async () => {
    vehicleRepoMock.findByPlateAndCompanyId.mockResolvedValue(
      buildVehicle({ isActive: false }),
    );
    blockRepoMock.findActiveByVehicleIdAndCompanyId.mockResolvedValue(null);

    const result = await useCase.execute(
      actor,
      new RegisterEntryInputDto('ABC1D23'),
    );

    expect(result.granted).toBe(false);
    expect(result.denial?.reason).toBe(EntryDenialReason.OTHER);
  });

  it('nega veículo não cadastrado sem solicitação autorizada (denial UNREGISTERED)', async () => {
    vehicleRepoMock.findByPlateAndCompanyId.mockResolvedValue(null);
    blockRepoMock.findActiveByPlateAndCompanyId.mockResolvedValue(null);

    const result = await useCase.execute(
      actor,
      new RegisterEntryInputDto('XYZ9A99'),
    );

    expect(result.granted).toBe(false);
    expect(result.denial?.reason).toBe(EntryDenialReason.UNREGISTERED);
    expect(accessRepoMock.createEntry).not.toHaveBeenCalled();
  });

  it('libera veículo não cadastrado com solicitação autorizada (dados temporários — ADR §4)', async () => {
    const request: AccessRequestEntity = {
      id: '50000000-0000-0000-0000-000000000020',
      companyId: actor.companyId,
      idempotencyKey: 'req-1',
      type: 'BOTH' as never,
      plate: 'XYZ9A99',
      vehicleId: null,
      userId: null,
      status: 'REGISTERED' as never,
      entryAuthorized: true,
      authorizedBy: actor.id,
      authorizedAt: new Date(),
      requestedBy: actor.id,
      requestedAt: new Date(),
      handledBy: null,
      handledAt: null,
      contactChannel: null,
      contactPhone: null,
      departmentId: null,
      payload: { driver: { name: 'Visitante', email: 'v@somar.local' } },
      statusHistory: [],
      resolvedUserId: null,
      resolvedVehicleId: null,
      observation: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    vehicleRepoMock.findByPlateAndCompanyId.mockResolvedValue(null);
    blockRepoMock.findActiveByPlateAndCompanyId.mockResolvedValue(null);
    accessRequestRepoMock.findByIdAndCompanyId.mockResolvedValue(request);
    accessRepoMock.countInsideByCompanyId.mockResolvedValue(0);
    departmentRepoMock.list.mockResolvedValue({ data: [], count: 0 });
    accessRepoMock.createEntry.mockResolvedValue({
      access: {
        ...access,
        vehicleId: null,
        temporaryPlate: 'XYZ9A99',
        temporaryDriverName: 'Visitante',
      },
      movement: { ...movement, vehicleId: null, plateSnapshot: 'XYZ9A99' },
      previousClosed: null,
    });

    const result = await useCase.execute(
      actor,
      new RegisterEntryInputDto(
        'XYZ9A99',
        undefined,
        undefined,
        undefined,
        request.id,
      ),
    );

    expect(result.granted).toBe(true);
    expect(accessRepoMock.createEntry).toHaveBeenCalledWith(
      expect.objectContaining({
        vehicleId: null,
        temporaryPlate: 'XYZ9A99',
        temporaryDriverName: 'Visitante',
        accessRequestId: request.id,
      }),
    );
  });

  it('lança 409 para vaga cheia sem overCapacity (regra 6)', async () => {
    vehicleRepoMock.findByPlateAndCompanyId.mockResolvedValue(
      buildVehicle({ freePass: true }),
    );
    blockRepoMock.findActiveByVehicleIdAndCompanyId.mockResolvedValue(null);
    accessRepoMock.countInsideByCompanyId.mockResolvedValue(10);
    departmentRepoMock.list.mockResolvedValue({
      data: [department],
      count: 1,
    });

    await expect(
      useCase.execute(actor, new RegisterEntryInputDto('ABC1D23')),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(accessRepoMock.createEntry).not.toHaveBeenCalled();
  });

  it('libera com overCapacity=true mesmo com vaga cheia', async () => {
    vehicleRepoMock.findByPlateAndCompanyId.mockResolvedValue(
      buildVehicle({ freePass: true }),
    );
    blockRepoMock.findActiveByVehicleIdAndCompanyId.mockResolvedValue(null);
    accessRepoMock.countInsideByCompanyId.mockResolvedValue(10);
    departmentRepoMock.list.mockResolvedValue({
      data: [department],
      count: 1,
    });
    accessRepoMock.createEntry.mockResolvedValue({
      access: { ...access, overCapacity: true },
      movement,
      previousClosed: null,
    });

    const result = await useCase.execute(
      actor,
      new RegisterEntryInputDto(
        'ABC1D23',
        undefined,
        undefined,
        undefined,
        undefined,
        true,
      ),
    );

    expect(result.granted).toBe(true);
    expect(accessRepoMock.createEntry).toHaveBeenCalledWith(
      expect.objectContaining({ overCapacity: true }),
    );
  });

  it('lança 404 para departamento inexistente', async () => {
    vehicleRepoMock.findByPlateAndCompanyId.mockResolvedValue(
      buildVehicle({ freePass: true }),
    );
    blockRepoMock.findActiveByVehicleIdAndCompanyId.mockResolvedValue(null);
    departmentRepoMock.findByIdAndCompanyId.mockResolvedValue(null);

    await expect(
      useCase.execute(
        actor,
        new RegisterEntryInputDto(
          'ABC1D23',
          undefined,
          undefined,
          departmentId,
        ),
      ),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('lança 400 para placa inválida', async () => {
    await expect(
      useCase.execute(actor, new RegisterEntryInputDto('ABC12')),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('devolve previousClosed quando há reentrada (regra 9)', async () => {
    vehicleRepoMock.findByPlateAndCompanyId.mockResolvedValue(
      buildVehicle({ freePass: true }),
    );
    blockRepoMock.findActiveByVehicleIdAndCompanyId.mockResolvedValue(null);
    accessRepoMock.countInsideByCompanyId.mockResolvedValue(0);
    departmentRepoMock.list.mockResolvedValue({ data: [], count: 0 });
    accessRepoMock.createEntry.mockResolvedValue({
      access,
      movement,
      previousClosed: {
        access: {
          ...access,
          id: '70000000-0000-0000-0000-000000000099',
          status: AccessStatus.OUT,
          forcedExit: true,
          exitAt: new Date(),
        },
        movement: {
          ...movement,
          id: '70000000-0000-0000-0000-000000000098',
          type: MovementType.EXIT,
        },
      },
    });

    const result = await useCase.execute(
      actor,
      new RegisterEntryInputDto('ABC1D23'),
    );

    expect(result.granted).toBe(true);
    expect(result.previousClosed?.access.forcedExit).toBe(true);
    expect(result.previousClosed?.movement.type).toBe(MovementType.EXIT);
  });

  it('registra entrada com source=QRCODE e portaria ativa (M4)', async () => {
    vehicleRepoMock.findByPlateAndCompanyId.mockResolvedValue(
      buildVehicle({ freePass: true }),
    );
    blockRepoMock.findActiveByVehicleIdAndCompanyId.mockResolvedValue(null);
    accessRepoMock.countInsideByCompanyId.mockResolvedValue(0);
    departmentRepoMock.list.mockResolvedValue({ data: [], count: 0 });
    accessRepoMock.createEntry.mockResolvedValue({
      access,
      movement,
      previousClosed: null,
    });
    entranceRepoMock.findByIdAndCompanyId.mockResolvedValue(entrance);

    const result = await useCase.execute(
      actor,
      new RegisterEntryInputDto(
        'ABC1D23',
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        MovementSource.QRCODE,
        entrance.id,
      ),
    );

    expect(result.granted).toBe(true);
    expect(entranceRepoMock.findByIdAndCompanyId).toHaveBeenCalledWith(
      entrance.id,
      actor.companyId,
    );
    expect(accessRepoMock.createEntry).toHaveBeenCalledWith(
      expect.objectContaining({
        source: MovementSource.QRCODE,
        entranceId: entrance.id,
      }),
    );
  });

  it('lança 400 para source interno (WEB) (M4)', async () => {
    await expect(
      useCase.execute(
        actor,
        new RegisterEntryInputDto(
          'ABC1D23',
          undefined,
          undefined,
          undefined,
          undefined,
          undefined,
          undefined,
          MovementSource.WEB,
        ),
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(accessRepoMock.createEntry).not.toHaveBeenCalled();
  });

  it('lança 404 para portaria inexistente (M4)', async () => {
    entranceRepoMock.findByIdAndCompanyId.mockResolvedValue(null);

    await expect(
      useCase.execute(
        actor,
        new RegisterEntryInputDto(
          'ABC1D23',
          undefined,
          undefined,
          undefined,
          undefined,
          undefined,
          undefined,
          MovementSource.QRCODE,
          '40000000-0000-0000-0000-000000000099',
        ),
      ),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(accessRepoMock.createEntry).not.toHaveBeenCalled();
  });

  it('lança 400 para portaria inativa (M4)', async () => {
    entranceRepoMock.findByIdAndCompanyId.mockResolvedValue({
      ...entrance,
      isActive: false,
    });

    await expect(
      useCase.execute(
        actor,
        new RegisterEntryInputDto(
          'ABC1D23',
          undefined,
          undefined,
          undefined,
          undefined,
          undefined,
          undefined,
          MovementSource.QRCODE,
          entrance.id,
        ),
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(accessRepoMock.createEntry).not.toHaveBeenCalled();
  });

  it('dedup: mesma idempotencyKey devolve a entrada já registrada (M4)', async () => {
    accessRepoMock.findMovementByIdempotencyKeyAndCompanyId.mockResolvedValue(
      movement,
    );
    accessRepoMock.findByIdAndCompanyId.mockResolvedValue(access);

    const result = await useCase.execute(
      actor,
      new RegisterEntryInputDto(
        'ABC1D23',
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        'mov-1',
      ),
    );

    expect(result.granted).toBe(true);
    expect(result.message).toBe('Entrada já registrada.');
    expect(result.access?.id).toBe(access.id);
    expect(result.movement?.id).toBe(movement.id);
    expect(accessRepoMock.createEntry).not.toHaveBeenCalled();
  });

  it('dedup: idempotencyKey nova segue o fluxo normal (M4)', async () => {
    accessRepoMock.findMovementByIdempotencyKeyAndCompanyId.mockResolvedValue(
      null,
    );
    vehicleRepoMock.findByPlateAndCompanyId.mockResolvedValue(
      buildVehicle({ freePass: true }),
    );
    blockRepoMock.findActiveByVehicleIdAndCompanyId.mockResolvedValue(null);
    accessRepoMock.countInsideByCompanyId.mockResolvedValue(0);
    departmentRepoMock.list.mockResolvedValue({ data: [], count: 0 });
    accessRepoMock.createEntry.mockResolvedValue({
      access,
      movement,
      previousClosed: null,
    });

    const result = await useCase.execute(
      actor,
      new RegisterEntryInputDto(
        'ABC1D23',
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        'mov-nova',
      ),
    );

    expect(result.granted).toBe(true);
    expect(accessRepoMock.createEntry).toHaveBeenCalledWith(
      expect.objectContaining({ idempotencyKey: 'mov-nova' }),
    );
  });
});
