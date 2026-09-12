// NestJS
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';

// Shared
import { PermissionCode } from '../../../../shared/constants/access-control.constant';

// Constants
import { UserType } from '../../../auth/domain/constants/user-type.constant';
import {
  AccessVerdict,
  AccessVerdictReason,
} from '../../domain/constants/access-verdict.constant';
import { AccessStatus } from '../../domain/constants/access.constant';
import {
  AccessRequestStatus,
  AccessRequestType,
} from '../../../access-requests/domain/constants/access-request.constant';
import {
  VehicleBlockStatus,
  VehicleBlockType,
} from '../../../blocks/domain/constants/block.constant';

// DTOs
import { GetAccessContextInputDto } from '../../application/dto/get-access-context-input.dto';

// Use case
import { GetAccessContextUseCase } from '../../application/use-cases/get-access-context.use-case';

// Repositories (tokens)
import { VEHICLE_REPOSITORY } from '../../../vehicles/domain/repositories/vehicle.repository';
import { VEHICLE_BLOCK_REPOSITORY } from '../../../blocks/domain/repositories/vehicle-block.repository';
import { VEHICLE_ACCESS_REPOSITORY } from '../../domain/repositories/vehicle-access.repository';
import { VEHICLE_DEPARTMENT_REPOSITORY } from '../../../vehicles/domain/repositories/vehicle-department.repository';
import { USER_VEHICLE_REPOSITORY } from '../../../vehicles/domain/repositories/user-vehicle.repository';
import { USER_COMPANY_REPOSITORY } from '../../../auth/domain/repositories/user-company.repository';
import { USER_REPOSITORY } from '../../../users/domain/repositories/user.repository';
import { ACCESS_REQUEST_REPOSITORY } from '../../../access-requests/domain/repositories/access-request.repository';
import { DEPARTMENT_REPOSITORY } from '../../../departments/domain/repositories/department.repository';

// Types
import type { AuthenticatedUserEntity } from '../../../auth/domain/entities/authenticated-user.entity';
import type { VehicleWithTypeEntity } from '../../../vehicles/domain/entities/vehicle.entity';
import type { VehicleBlockEntity } from '../../../blocks/domain/entities/vehicle-block.entity';
import type { VehicleAccessEntity } from '../../domain/entities/vehicle-access.entity';
import type { DepartmentEntity } from '../../../departments/domain/entities/department.entity';
import type { UserVehicleWithUserEntity } from '../../../vehicles/domain/entities/user-vehicle.entity';
import type { AccessRequestEntity } from '../../../access-requests/domain/entities/access-request.entity';
import type { VehicleRepository } from '../../../vehicles/domain/repositories/vehicle.repository';
import type { VehicleBlockRepository } from '../../../blocks/domain/repositories/vehicle-block.repository';
import type { VehicleAccessRepository } from '../../domain/repositories/vehicle-access.repository';
import type { VehicleDepartmentRepository } from '../../../vehicles/domain/repositories/vehicle-department.repository';
import type { UserVehicleRepository } from '../../../vehicles/domain/repositories/user-vehicle.repository';
import type { UserCompanyRepository } from '../../../auth/domain/repositories/user-company.repository';
import type { UserRepository } from '../../../users/domain/repositories/user.repository';
import type { AccessRequestRepository } from '../../../access-requests/domain/repositories/access-request.repository';
import type { DepartmentRepository } from '../../../departments/domain/repositories/department.repository';

describe('GetAccessContextUseCase', () => {
  let useCase: GetAccessContextUseCase;

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

  const accessRepoMock = {
    findOpenByVehicleIdAndCompanyId: jest.fn(),
    findOpenByTemporaryPlateAndCompanyId: jest.fn(),
    countInsideByDepartmentIdAndCompanyId: jest.fn(),
    countInsideByCompanyId: jest.fn(),
  } as jest.Mocked<
    Pick<
      VehicleAccessRepository,
      | 'findOpenByVehicleIdAndCompanyId'
      | 'findOpenByTemporaryPlateAndCompanyId'
      | 'countInsideByDepartmentIdAndCompanyId'
      | 'countInsideByCompanyId'
    >
  >;

  const vehicleDepartmentRepoMock = {
    findActiveByVehicleIdAndCompanyId: jest.fn(),
  } as jest.Mocked<
    Pick<VehicleDepartmentRepository, 'findActiveByVehicleIdAndCompanyId'>
  >;

  const userVehicleRepoMock = {
    findByVehicleIdAndCompanyId: jest.fn(),
  } as jest.Mocked<Pick<UserVehicleRepository, 'findByVehicleIdAndCompanyId'>>;

  const userCompanyRepoMock = {
    listByCompanyId: jest.fn(),
  } as jest.Mocked<Pick<UserCompanyRepository, 'listByCompanyId'>>;

  const userRepoMock = {
    findById: jest.fn(),
  } as jest.Mocked<Pick<UserRepository, 'findById'>>;

  const accessRequestRepoMock = {
    list: jest.fn(),
  } as jest.Mocked<Pick<AccessRequestRepository, 'list'>>;

  const departmentRepoMock = {
    findByIdAndCompanyId: jest.fn(),
    list: jest.fn(),
  } as jest.Mocked<Pick<DepartmentRepository, 'findByIdAndCompanyId' | 'list'>>;

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

  const vehicle: VehicleWithTypeEntity = {
    id: '40000000-0000-0000-0000-000000000010',
    plate: 'ABC1D23',
    companyId: actor.companyId,
    model: 'Onix',
    color: 'Prata',
    observation: null,
    isBlocked: false,
    freePass: false,
    vehicleTypeId: '40000000-0000-0000-0000-000000000001',
    isActive: true,
    createdAt: new Date('2026-08-01T10:00:00.000Z'),
    updatedAt: new Date('2026-08-01T10:00:00.000Z'),
    vehicleType: {
      id: '40000000-0000-0000-0000-000000000001',
      code: 'FROTA',
      name: 'Frota',
      isFleet: true,
    },
  };

  const block: VehicleBlockEntity = {
    id: '80000000-0000-0000-0000-000000000001',
    companyId: actor.companyId,
    vehicleId: vehicle.id,
    plate: vehicle.plate,
    blockType: VehicleBlockType.MANUAL,
    reason: 'Documentação irregular',
    status: VehicleBlockStatus.ACTIVE,
    blockedBy: actor.id,
    blockedAt: new Date('2026-09-05T12:00:00.000Z'),
    revokedBy: null,
    revokedAt: null,
    revokedReason: null,
    createdAt: new Date('2026-09-05T12:00:00.000Z'),
    updatedAt: new Date('2026-09-05T12:00:00.000Z'),
  };

  const department: DepartmentEntity = {
    id: '50000000-0000-0000-0000-000000000001',
    companyId: actor.companyId,
    name: 'Recepção',
    description: null,
    parkingSpace: 1,
    isActive: true,
    createdAt: new Date('2026-08-01T10:00:00.000Z'),
    updatedAt: new Date('2026-08-01T10:00:00.000Z'),
  };

  const linkedDriver = (
    id: string,
    name: string,
    canDrive = true,
    isPrimary = false,
  ): UserVehicleWithUserEntity => ({
    id: `90000000-0000-0000-0000-00000000000${id.slice(-1)}`,
    companyId: actor.companyId,
    userId: id,
    vehicleId: vehicle.id,
    isPrimary,
    canDrive,
    createdAt: new Date(),
    updatedAt: new Date(),
    user: { id, name },
  });

  const accessRequest = (
    overrides: Partial<AccessRequestEntity> = {},
  ): AccessRequestEntity => ({
    id: '60000000-0000-0000-0000-000000000001',
    companyId: actor.companyId,
    idempotencyKey: '60000000-0000-0000-0000-000000000099',
    type: AccessRequestType.NEW_USER,
    userType: UserType.VISITOR,
    plate: vehicle.plate,
    vehicleId: vehicle.id,
    userId: null,
    status: AccessRequestStatus.PENDING,
    entryAuthorized: false,
    authorizedBy: null,
    authorizedAt: null,
    requestedBy: actor.id,
    requestedAt: new Date(),
    handledBy: null,
    handledAt: null,
    contactChannel: null,
    contactPhone: null,
    departmentId: null,
    payload: { driver: { name: 'Novo Motorista' } },
    statusHistory: [],
    resolvedUserId: null,
    resolvedVehicleId: null,
    observation: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  });

  const openAccess: VehicleAccessEntity = {
    id: '70000000-0000-0000-0000-000000000001',
    companyId: actor.companyId,
    vehicleId: vehicle.id,
    temporaryPlate: null,
    driverUserId: null,
    temporaryDriverName: null,
    departmentId: null,
    accessRequestId: null,
    overCapacity: false,
    status: AccessStatus.INSIDE,
    forcedExit: false,
    entryAt: new Date('2026-09-12T10:00:00.000Z'),
    exitAt: null,
    closedBy: null,
    closedAt: null,
    createdAt: new Date('2026-09-12T10:00:00.000Z'),
    updatedAt: new Date('2026-09-12T10:00:00.000Z'),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    vehicleRepoMock.findByPlateAndCompanyId.mockResolvedValue(vehicle);
    blockRepoMock.findActiveByVehicleIdAndCompanyId.mockResolvedValue(null);
    blockRepoMock.findActiveByPlateAndCompanyId.mockResolvedValue(null);
    accessRepoMock.findOpenByVehicleIdAndCompanyId.mockResolvedValue([]);
    accessRepoMock.findOpenByTemporaryPlateAndCompanyId.mockResolvedValue([]);
    accessRepoMock.countInsideByDepartmentIdAndCompanyId.mockResolvedValue(0);
    accessRepoMock.countInsideByCompanyId.mockResolvedValue(0);
    vehicleDepartmentRepoMock.findActiveByVehicleIdAndCompanyId.mockResolvedValue(
      null,
    );
    userVehicleRepoMock.findByVehicleIdAndCompanyId.mockResolvedValue([]);
    userCompanyRepoMock.listByCompanyId.mockResolvedValue({
      data: [],
      count: 0,
    });
    userRepoMock.findById.mockResolvedValue(null);
    accessRequestRepoMock.list.mockResolvedValue({ data: [], count: 0 });
    departmentRepoMock.findByIdAndCompanyId.mockResolvedValue(null);
    departmentRepoMock.list.mockResolvedValue({ data: [], count: 0 });

    const module = await Test.createTestingModule({
      providers: [
        GetAccessContextUseCase,
        { provide: VEHICLE_REPOSITORY, useValue: vehicleRepoMock },
        { provide: VEHICLE_BLOCK_REPOSITORY, useValue: blockRepoMock },
        { provide: VEHICLE_ACCESS_REPOSITORY, useValue: accessRepoMock },
        {
          provide: VEHICLE_DEPARTMENT_REPOSITORY,
          useValue: vehicleDepartmentRepoMock,
        },
        { provide: USER_VEHICLE_REPOSITORY, useValue: userVehicleRepoMock },
        { provide: USER_COMPANY_REPOSITORY, useValue: userCompanyRepoMock },
        { provide: USER_REPOSITORY, useValue: userRepoMock },
        { provide: ACCESS_REQUEST_REPOSITORY, useValue: accessRequestRepoMock },
        { provide: DEPARTMENT_REPOSITORY, useValue: departmentRepoMock },
      ],
    }).compile();
    useCase = module.get(GetAccessContextUseCase);
  });

  it('rejeita placa inválida', async () => {
    await expect(
      useCase.execute(actor, new GetAccessContextInputDto('ABC')),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('nega por bloqueio ativo — prevalece até sobre o passe livre (regra 20)', async () => {
    vehicleRepoMock.findByPlateAndCompanyId.mockResolvedValue({
      ...vehicle,
      freePass: true,
    });
    blockRepoMock.findActiveByVehicleIdAndCompanyId.mockResolvedValue(block);

    const result = await useCase.execute(
      actor,
      new GetAccessContextInputDto(vehicle.plate),
    );

    expect(result.verdict).toBe(AccessVerdict.DENY_BLOCKED);
    expect(result.reasons).toContain(AccessVerdictReason.BLOCKED);
    expect(result.block).toMatchObject({
      id: block.id,
      reason: block.reason,
      blockType: VehicleBlockType.MANUAL,
    });
    expect(result.requiresRequest).toBe(false);
  });

  it('consulta bloqueio por placa quando o veículo não está cadastrado', async () => {
    vehicleRepoMock.findByPlateAndCompanyId.mockResolvedValue(null);
    blockRepoMock.findActiveByPlateAndCompanyId.mockResolvedValue({
      ...block,
      vehicleId: null,
    });

    const result = await useCase.execute(
      actor,
      new GetAccessContextInputDto(vehicle.plate),
    );

    expect(blockRepoMock.findActiveByPlateAndCompanyId).toHaveBeenCalledWith(
      vehicle.plate,
      actor.companyId,
    );
    expect(result.verdict).toBe(AccessVerdict.DENY_BLOCKED);
    expect(result.vehicle).toBeNull();
  });

  it('nega veículo inativo', async () => {
    vehicleRepoMock.findByPlateAndCompanyId.mockResolvedValue({
      ...vehicle,
      isActive: false,
    });

    const result = await useCase.execute(
      actor,
      new GetAccessContextInputDto(vehicle.plate),
    );

    expect(result.verdict).toBe(AccessVerdict.DENY_INACTIVE);
    expect(result.reasons).toContain(AccessVerdictReason.INACTIVE);
  });

  it('libera passe livre sem exigir motorista (regra 3)', async () => {
    vehicleRepoMock.findByPlateAndCompanyId.mockResolvedValue({
      ...vehicle,
      freePass: true,
    });

    const result = await useCase.execute(
      actor,
      new GetAccessContextInputDto(vehicle.plate),
    );

    expect(result.verdict).toBe(AccessVerdict.ALLOW);
    expect(result.reasons).toContain(AccessVerdictReason.FREE_PASS);
    expect(result.requiresRequest).toBe(false);
  });

  it('libera quando há motorista vinculado autorizado a dirigir (regra 4)', async () => {
    const driver = linkedDriver(
      '30000000-0000-0000-0000-000000000030',
      'Ana Motorista',
      true,
      true,
    );
    userVehicleRepoMock.findByVehicleIdAndCompanyId.mockResolvedValue([driver]);

    const result = await useCase.execute(
      actor,
      new GetAccessContextInputDto(vehicle.plate),
    );

    expect(result.verdict).toBe(AccessVerdict.ALLOW);
    expect(result.reasons).toContain(AccessVerdictReason.DRIVER_ALLOWED);
    expect(result.requiresRequest).toBe(false);
    expect(result.drivers.linked).toEqual([
      expect.objectContaining({
        id: driver.userId,
        name: driver.user.name,
        linked: true,
        canDrive: true,
        isPrimary: true,
      }),
    ]);
  });

  it('exige solicitação quando não há motorista vinculado', async () => {
    const result = await useCase.execute(
      actor,
      new GetAccessContextInputDto(vehicle.plate),
    );

    expect(result.verdict).toBe(AccessVerdict.ALLOW_WITH_REQUEST);
    expect(result.reasons).toContain(AccessVerdictReason.UNREGISTERED_DRIVER);
    expect(result.requiresRequest).toBe(true);
    expect(result.reusableRequestId).toBeNull();
  });

  it('trata can_drive = false como não vinculado (motorista escolhido)', async () => {
    const driver = linkedDriver(
      '30000000-0000-0000-0000-000000000031',
      'Bruno Motorista',
      false,
    );
    userVehicleRepoMock.findByVehicleIdAndCompanyId.mockResolvedValue([driver]);

    const result = await useCase.execute(
      actor,
      new GetAccessContextInputDto(
        vehicle.plate,
        undefined,
        undefined,
        driver.userId,
      ),
    );

    expect(result.verdict).toBe(AccessVerdict.ALLOW_WITH_REQUEST);
    expect(result.reasons).toContain(AccessVerdictReason.DRIVER_NOT_ALLOWED);
    expect(result.requiresRequest).toBe(true);
  });

  it('libera o motorista escolhido quando ele está vinculado e pode dirigir', async () => {
    const driver = linkedDriver(
      '30000000-0000-0000-0000-000000000032',
      'Carla Motorista',
      true,
    );
    userVehicleRepoMock.findByVehicleIdAndCompanyId.mockResolvedValue([driver]);

    const result = await useCase.execute(
      actor,
      new GetAccessContextInputDto(
        vehicle.plate,
        undefined,
        undefined,
        driver.userId,
      ),
    );

    expect(result.verdict).toBe(AccessVerdict.ALLOW);
    expect(result.requiresRequest).toBe(false);
  });

  it('placa não cadastrada sem solicitação exige solicitação nova', async () => {
    vehicleRepoMock.findByPlateAndCompanyId.mockResolvedValue(null);

    const result = await useCase.execute(
      actor,
      new GetAccessContextInputDto('XYZ9A99'),
    );

    expect(result.verdict).toBe(AccessVerdict.ALLOW_WITH_REQUEST);
    expect(result.reasons).toContain(AccessVerdictReason.UNREGISTERED_VEHICLE);
    expect(result.requiresRequest).toBe(true);
    expect(result.reusableRequestId).toBeNull();
    expect(result.vehicle).toBeNull();
  });

  it('reaproveita a solicitação aberta da placa (reusableRequestId)', async () => {
    vehicleRepoMock.findByPlateAndCompanyId.mockResolvedValue(null);
    const request = accessRequest({
      type: AccessRequestType.BOTH,
      vehicleId: null,
      requestedAt: new Date(),
    });
    accessRequestRepoMock.list.mockResolvedValue({ data: [request], count: 1 });

    const result = await useCase.execute(
      actor,
      new GetAccessContextInputDto(vehicle.plate),
    );

    expect(result.requiresRequest).toBe(true);
    expect(result.reusableRequestId).toBe(request.id);
    expect(result.reasons).toContain(AccessVerdictReason.REQUEST_OPEN);
    expect(result.requests[0]).toMatchObject({
      id: request.id,
      status: AccessRequestStatus.PENDING,
      driverName: 'Novo Motorista',
      isOverdue: false,
    });
  });

  it('nega por prazo vencido (PENDING > 3 dias) e reporta o vencimento', async () => {
    accessRequestRepoMock.list.mockResolvedValue({
      data: [
        accessRequest({
          requestedAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
        }),
      ],
      count: 1,
    });

    const result = await useCase.execute(
      actor,
      new GetAccessContextInputDto(vehicle.plate),
    );

    expect(result.verdict).toBe(AccessVerdict.DENY_OVERDUE);
    expect(result.reasons).toContain(AccessVerdictReason.REQUEST_OVERDUE);
    expect(result.requests[0].isOverdue).toBe(true);
    expect(result.requests[0].daysSinceRequest).toBe(5);
    expect(result.requests[0].deadline).not.toBeNull();
  });

  it('a pré-autorização da administração sobrepõe o prazo (ADR 0014 §1)', async () => {
    const driver = linkedDriver(
      '30000000-0000-0000-0000-000000000033',
      'Diego Motorista',
      true,
    );
    userVehicleRepoMock.findByVehicleIdAndCompanyId.mockResolvedValue([driver]);
    accessRequestRepoMock.list.mockResolvedValue({
      data: [
        accessRequest({
          entryAuthorized: true,
          requestedAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
        }),
      ],
      count: 1,
    });

    const result = await useCase.execute(
      actor,
      new GetAccessContextInputDto(vehicle.plate),
    );

    expect(result.verdict).toBe(AccessVerdict.ALLOW);
    expect(result.reasons).toContain(
      AccessVerdictReason.REQUEST_PRE_AUTHORIZED,
    );
    expect(result.reasons).not.toContain(AccessVerdictReason.REQUEST_OVERDUE);
  });

  it('avisa vaga cheia quando há motorista autorizado (regras 6/25)', async () => {
    userVehicleRepoMock.findByVehicleIdAndCompanyId.mockResolvedValue([
      linkedDriver('30000000-0000-0000-0000-000000000039', 'Fábio Motorista'),
    ]);
    departmentRepoMock.findByIdAndCompanyId.mockResolvedValue(department);
    accessRepoMock.countInsideByDepartmentIdAndCompanyId.mockResolvedValue(1);

    const result = await useCase.execute(
      actor,
      new GetAccessContextInputDto(
        vehicle.plate,
        undefined,
        department.id,
        undefined,
      ),
    );

    expect(result.verdict).toBe(AccessVerdict.ALLOW_OVER_CAPACITY);
    expect(result.requiresOverCapacity).toBe(true);
    expect(result.requiresRequest).toBe(false);
    expect(result.reasons).toContain(AccessVerdictReason.CAPACITY_FULL);
    expect(result.department).toMatchObject({
      id: department.id,
      capacity: 1,
      occupied: 1,
      hasFreeSlot: false,
    });
  });

  it('expõe os dois requisitos quando há exceção e vaga cheia ao mesmo tempo', async () => {
    departmentRepoMock.findByIdAndCompanyId.mockResolvedValue(department);
    accessRepoMock.countInsideByDepartmentIdAndCompanyId.mockResolvedValue(1);

    const result = await useCase.execute(
      actor,
      new GetAccessContextInputDto(
        vehicle.plate,
        undefined,
        department.id,
        undefined,
      ),
    );

    // A exceção (criar solicitação) é a interação principal da ficha; a
    // confirmação de capacidade vem pelo flag — o cliente envia os dois.
    expect(result.verdict).toBe(AccessVerdict.ALLOW_WITH_REQUEST);
    expect(result.requiresRequest).toBe(true);
    expect(result.requiresOverCapacity).toBe(true);
    expect(result.reasons).toEqual(
      expect.arrayContaining([
        AccessVerdictReason.UNREGISTERED_DRIVER,
        AccessVerdictReason.CAPACITY_FULL,
      ]),
    );
  });

  it('pré-seleciona o departamento padrão do veículo (regra 27)', async () => {
    vehicleDepartmentRepoMock.findActiveByVehicleIdAndCompanyId.mockResolvedValue(
      {
        id: '51000000-0000-0000-0000-000000000001',
        companyId: actor.companyId,
        vehicleId: vehicle.id,
        departmentId: department.id,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    );
    departmentRepoMock.findByIdAndCompanyId.mockResolvedValue(department);

    const result = await useCase.execute(
      actor,
      new GetAccessContextInputDto(vehicle.plate),
    );

    expect(result.department.defaultId).toBe(department.id);
    expect(result.department.id).toBe(department.id);
    expect(result.department.name).toBe(department.name);
  });

  it('falha quando o departamento informado não existe', async () => {
    await expect(
      useCase.execute(
        actor,
        new GetAccessContextInputDto(
          vehicle.plate,
          undefined,
          '50000000-0000-0000-0000-000000000099',
          undefined,
        ),
      ),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('marca reentrada quando já existe acesso aberto (regra 9)', async () => {
    const driver = linkedDriver(
      '30000000-0000-0000-0000-000000000034',
      'Elisa Motorista',
      true,
    );
    userVehicleRepoMock.findByVehicleIdAndCompanyId.mockResolvedValue([driver]);
    accessRepoMock.findOpenByVehicleIdAndCompanyId.mockResolvedValue([
      openAccess,
    ]);
    userRepoMock.findById.mockResolvedValue({
      id: '30000000-0000-0000-0000-000000000035',
      name: 'Quem entrou',
      email: null,
      passwordHash: null,
      phone: null,
      document: null,
      photoUrl: null,
      lastLoginAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const result = await useCase.execute(
      actor,
      new GetAccessContextInputDto(vehicle.plate),
    );

    expect(result.verdict).toBe(AccessVerdict.ALLOW_FORCED_REENTRY);
    expect(result.isReentry).toBe(true);
    expect(result.reasons).toContain(AccessVerdictReason.REENTRY);
    expect(result.openAccesses).toHaveLength(1);
  });

  it('busca motorista e sugere pessoas sem vínculo (3 + 3 na tela)', async () => {
    const driver = linkedDriver(
      '30000000-0000-0000-0000-000000000036',
      'Ana Paula',
      true,
      true,
    );
    userVehicleRepoMock.findByVehicleIdAndCompanyId.mockResolvedValue([driver]);
    userCompanyRepoMock.listByCompanyId.mockResolvedValue({
      data: [
        {
          linkId: '91000000-0000-0000-0000-000000000001',
          userId: '30000000-0000-0000-0000-000000000036',
          name: 'Ana Paula',
          email: null,
          phone: null,
          document: null,
          photoUrl: null,
          type: UserType.VISITOR,
          isActive: true,
        },
        {
          linkId: '91000000-0000-0000-0000-000000000002',
          userId: '30000000-0000-0000-0000-000000000037',
          name: 'Ana Souza',
          email: null,
          phone: null,
          document: null,
          photoUrl: null,
          type: UserType.VISITOR,
          isActive: true,
        },
      ],
      count: 2,
    });

    const result = await useCase.execute(
      actor,
      new GetAccessContextInputDto(vehicle.plate, 'Ana'),
    );

    expect(userCompanyRepoMock.listByCompanyId).toHaveBeenCalledWith(
      actor.companyId,
      expect.objectContaining({ search: 'Ana', isActive: true }),
    );
    expect(result.drivers.search).toBe('Ana');
    expect(result.drivers.linked.map((d) => d.name)).toEqual(['Ana Paula']);
    expect(result.drivers.suggestions).toEqual([
      expect.objectContaining({
        id: '30000000-0000-0000-0000-000000000037',
        name: 'Ana Souza',
        linked: false,
      }),
    ]);
  });

  it('sem busca, não devolve sugestões (só vinculados)', async () => {
    userVehicleRepoMock.findByVehicleIdAndCompanyId.mockResolvedValue([
      linkedDriver('30000000-0000-0000-0000-000000000038', 'Zeca', true),
    ]);

    const result = await useCase.execute(
      actor,
      new GetAccessContextInputDto(vehicle.plate),
    );

    expect(result.drivers.search).toBeNull();
    expect(result.drivers.suggestions).toEqual([]);
    expect(result.drivers.linked).toHaveLength(1);
  });
});
