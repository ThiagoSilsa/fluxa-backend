// NestJS
import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';

// Shared
import { PermissionCode } from '../../../../shared/constants/access-control.constant';
import { PasswordHashUseCase } from '../../../../shared/security/password-hash.use-case';

// Constants
import { UserType } from '../../../auth/domain/constants/user-type.constant';
import {
  AccessRequestStatus,
  AccessRequestType,
  ContactChannel,
} from '../../domain/constants/access-request.constant';

// Types
import type { AuthenticatedUserEntity } from '../../../auth/domain/entities/authenticated-user.entity';
import type { AccessRequestEntity } from '../../domain/entities/access-request.entity';
import type { UserEntity } from '../../../users/domain/entities/user.entity';
import type { VehicleWithTypeEntity } from '../../../vehicles/domain/entities/vehicle.entity';
import type { VehicleTypeEntity } from '../../../vehicles/domain/entities/vehicle-type.entity';
import type { UserVehicleEntity } from '../../../vehicles/domain/entities/user-vehicle.entity';
import type { AccessRequestRepository } from '../../domain/repositories/access-request.repository';
import type { RoleEntity } from '../../../roles/domain/entities/role.entity';
import type { UserRepository } from '../../../users/domain/repositories/user.repository';
import type { VehicleRepository } from '../../../vehicles/domain/repositories/vehicle.repository';
import type { VehicleTypeRepository } from '../../../vehicles/domain/repositories/vehicle-type.repository';
import type { UserVehicleRepository } from '../../../vehicles/domain/repositories/user-vehicle.repository';
import type { RoleRepository } from '../../../roles/domain/repositories/role.repository';

// Repositories
import { ACCESS_REQUEST_REPOSITORY } from '../../domain/repositories/access-request.repository';
import { ROLE_REPOSITORY } from '../../../roles/domain/repositories/role.repository';
import { USER_REPOSITORY } from '../../../users/domain/repositories/user.repository';
import { VEHICLE_REPOSITORY } from '../../../vehicles/domain/repositories/vehicle.repository';
import { VEHICLE_TYPE_REPOSITORY } from '../../../vehicles/domain/repositories/vehicle-type.repository';
import { USER_VEHICLE_REPOSITORY } from '../../../vehicles/domain/repositories/user-vehicle.repository';

// DTOs
import { AcceptAccessRequestInputDto } from '../../application/dto/accept-access-request-input.dto';

// Use case
import { AcceptAccessRequestUseCase } from '../../application/use-cases/accept-access-request.use-case';

describe('AcceptAccessRequestUseCase', () => {
  let useCase: AcceptAccessRequestUseCase;

  const accessRequestRepoMock = {
    findByIdAndCompanyId: jest.fn(),
    updateStatusByIdAndCompanyId: jest.fn(),
  } as jest.Mocked<
    Pick<
      AccessRequestRepository,
      'findByIdAndCompanyId' | 'updateStatusByIdAndCompanyId'
    >
  >;

  const userRepoMock = {
    findById: jest.fn(),
    findByEmail: jest.fn(),
    create: jest.fn(),
  } as jest.Mocked<Pick<UserRepository, 'findById' | 'findByEmail' | 'create'>>;

  const roleRepoMock = {
    findByIdAndCompanyId: jest.fn(),
  } as jest.Mocked<Pick<RoleRepository, 'findByIdAndCompanyId'>>;

  const vehicleRepoMock = {
    findByIdAndCompanyId: jest.fn(),
    findByPlateAndCompanyId: jest.fn(),
    create: jest.fn(),
  } as jest.Mocked<
    Pick<
      VehicleRepository,
      'findByIdAndCompanyId' | 'findByPlateAndCompanyId' | 'create'
    >
  >;

  const vehicleTypeRepoMock = {
    findByIdAndCompanyId: jest.fn(),
  } as jest.Mocked<Pick<VehicleTypeRepository, 'findByIdAndCompanyId'>>;

  const userVehicleRepoMock = {
    findByUserIdAndVehicleIdAndCompanyId: jest.fn(),
    create: jest.fn(),
    updateByIdAndCompanyId: jest.fn(),
  } as jest.Mocked<
    Pick<
      UserVehicleRepository,
      | 'findByUserIdAndVehicleIdAndCompanyId'
      | 'create'
      | 'updateByIdAndCompanyId'
    >
  >;

  const passwordHashMock = {
    execute: jest.fn(() => 'hash'),
  };

  const role: RoleEntity = {
    id: '70000000-0000-0000-0000-000000000001',
    companyId: '10000000-0000-0000-0000-000000000001',
    name: 'Porteiro',
    description: null,
    isAdmin: false,
    isActive: true,
    createdAt: new Date('2026-08-21T00:00:00Z'),
    updatedAt: new Date('2026-08-21T00:00:00Z'),
  };

  const admin: AuthenticatedUserEntity = {
    id: '30000000-0000-0000-0000-000000000001',
    companyId: '10000000-0000-0000-0000-000000000001',
    email: 'admin@somar.local',
    name: 'Administrador',
    type: UserType.EMPLOYEE,
    isAdmin: true,
    roleCodes: ['Administração'],
    permissions: [PermissionCode.MANAGE_ACCESS_REQUESTS],
  };

  const vehicleId = '40000000-0000-0000-0000-000000000010';
  const driverUserId = '30000000-0000-0000-0000-000000000005';

  const vehicle: VehicleWithTypeEntity = {
    id: vehicleId,
    plate: 'ABC1D23',
    companyId: admin.companyId,
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
  };

  const vehicleType: VehicleTypeEntity = {
    id: '40000000-0000-0000-0000-000000000001',
    companyId: admin.companyId,
    code: 'FROTA',
    name: 'Frota',
    description: null,
    isFleet: true,
    isActive: true,
    createdAt: new Date('2026-08-21T00:00:00Z'),
    updatedAt: new Date('2026-08-21T00:00:00Z'),
  };

  const driverUser: UserEntity = {
    id: driverUserId,
    name: 'Visitante',
    email: 'visitante@somar.local',
    passwordHash: 'hash',
    phone: null,
    document: null,
    photoUrl: null,
    lastLoginAt: null,
    createdAt: new Date('2026-08-24T12:00:00Z'),
    updatedAt: new Date('2026-08-24T12:00:00Z'),
  };

  const link: UserVehicleEntity = {
    id: '60000000-0000-0000-0000-000000000001',
    companyId: admin.companyId,
    userId: driverUserId,
    vehicleId,
    isPrimary: false,
    canDrive: true,
    createdAt: new Date('2026-08-24T12:00:00Z'),
    updatedAt: new Date('2026-08-24T12:00:00Z'),
  };

  /**
   * Vínculo existente **sem** permissão de dirigir — o estado que o aceite da
   * solicitação da portaria precisa promover (ticket 07).
   */
  const linkWithoutPermission: UserVehicleEntity = {
    ...link,
    canDrive: false,
  };

  function buildRequest(
    type: AccessRequestType,
    overrides: Partial<AccessRequestEntity> = {},
  ): AccessRequestEntity {
    return {
      id: '50000000-0000-0000-0000-000000000001',
      companyId: admin.companyId,
      idempotencyKey: 'req-1',
      type,
      userType: UserType.VISITOR,
      plate: 'ABC1D23',
      vehicleId: null,
      userId: null,
      status: AccessRequestStatus.PENDING,
      entryAuthorized: false,
      authorizedBy: null,
      authorizedAt: null,
      requestedBy: '30000000-0000-0000-0000-000000000002',
      requestedAt: new Date('2026-08-24T11:00:00Z'),
      handledBy: null,
      handledAt: null,
      contactChannel: ContactChannel.WHATSAPP,
      contactPhone: '11999999999',
      departmentId: null,
      payload: {},
      statusHistory: [],
      resolvedUserId: null,
      resolvedVehicleId: null,
      observation: null,
      createdAt: new Date('2026-08-24T11:00:00Z'),
      updatedAt: new Date('2026-08-24T11:00:00Z'),
      ...overrides,
    };
  }

  beforeEach(async () => {
    jest.clearAllMocks();
    const module = await Test.createTestingModule({
      providers: [
        AcceptAccessRequestUseCase,
        { provide: ACCESS_REQUEST_REPOSITORY, useValue: accessRequestRepoMock },
        { provide: USER_REPOSITORY, useValue: userRepoMock },
        { provide: ROLE_REPOSITORY, useValue: roleRepoMock },
        { provide: VEHICLE_REPOSITORY, useValue: vehicleRepoMock },
        { provide: VEHICLE_TYPE_REPOSITORY, useValue: vehicleTypeRepoMock },
        { provide: USER_VEHICLE_REPOSITORY, useValue: userVehicleRepoMock },
        { provide: PasswordHashUseCase, useValue: passwordHashMock },
      ],
    }).compile();
    useCase = module.get(AcceptAccessRequestUseCase);
  });

  it('aceita NEW_USER criando usuário VISITOR e o vínculo', async () => {
    const request = buildRequest(AccessRequestType.NEW_USER, {
      vehicleId,
      payload: {
        driver: {
          name: 'Visitante',
          email: 'visitante@somar.local',
          phone: '11999999999',
        },
      },
    });
    accessRequestRepoMock.findByIdAndCompanyId.mockResolvedValue(request);
    vehicleRepoMock.findByIdAndCompanyId.mockResolvedValue(vehicle);
    userRepoMock.findByEmail.mockResolvedValue(null);
    userRepoMock.create.mockResolvedValue(driverUser);
    userVehicleRepoMock.findByUserIdAndVehicleIdAndCompanyId.mockResolvedValue(
      null,
    );
    userVehicleRepoMock.create.mockResolvedValue(link);
    accessRequestRepoMock.updateStatusByIdAndCompanyId.mockImplementation(
      (id, companyId, data) =>
        Promise.resolve(
          buildRequest(AccessRequestType.NEW_USER, {
            ...(data as Partial<AccessRequestEntity>),
            vehicleId,
          }),
        ),
    );

    const result = await useCase.execute(
      admin,
      new AcceptAccessRequestInputDto(request.id, undefined, true, false),
    );

    // Cria VISITOR sem credenciais (ADR 0013) e vinculo can_drive.
    expect(userRepoMock.create).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'Visitante',
        email: 'visitante@somar.local',
        passwordHash: null,
        phone: '11999999999',
        companyId: admin.companyId,
        type: UserType.VISITOR,
        isActive: true,
      }),
    );
    expect(passwordHashMock.execute).not.toHaveBeenCalled();
    expect(userVehicleRepoMock.create).toHaveBeenCalledWith({
      companyId: admin.companyId,
      userId: driverUserId,
      vehicleId,
      isPrimary: false,
      canDrive: true,
    });
    expect(
      accessRequestRepoMock.updateStatusByIdAndCompanyId,
    ).toHaveBeenCalledWith(
      request.id,
      admin.companyId,
      expect.objectContaining({
        status: AccessRequestStatus.REGISTERED,
        resolvedUserId: driverUserId,
        resolvedVehicleId: vehicleId,
        entryAuthorized: true,
        authorizedBy: admin.id,
      }),
    );
    expect(result.status).toBe(AccessRequestStatus.REGISTERED);
    expect(result.entryAuthorized).toBe(true);
  });

  it('aceita NEW_VEHICLE criando veículo com o tipo escolhido (regra 22)', async () => {
    const request = buildRequest(AccessRequestType.NEW_VEHICLE, {
      userId: driverUserId,
      payload: { vehicle: { model: 'Onix', color: 'Prata' } },
    });
    accessRequestRepoMock.findByIdAndCompanyId.mockResolvedValue(request);
    userRepoMock.findById.mockResolvedValue(driverUser);
    vehicleTypeRepoMock.findByIdAndCompanyId.mockResolvedValue(vehicleType);
    vehicleRepoMock.findByPlateAndCompanyId.mockResolvedValue(null);
    vehicleRepoMock.create.mockResolvedValue(vehicle);
    userVehicleRepoMock.findByUserIdAndVehicleIdAndCompanyId.mockResolvedValue(
      null,
    );
    userVehicleRepoMock.create.mockResolvedValue(link);
    accessRequestRepoMock.updateStatusByIdAndCompanyId.mockResolvedValue(
      buildRequest(AccessRequestType.NEW_VEHICLE, {
        userId: driverUserId,
        status: AccessRequestStatus.REGISTERED,
        resolvedUserId: driverUserId,
        resolvedVehicleId: vehicleId,
        entryAuthorized: true,
        authorizedBy: admin.id,
      }),
    );

    const result = await useCase.execute(
      admin,
      new AcceptAccessRequestInputDto(request.id, vehicleType.id, true, false),
    );

    expect(vehicleRepoMock.create).toHaveBeenCalledWith({
      plate: 'ABC1D23',
      companyId: admin.companyId,
      model: 'Onix',
      color: 'Prata',
      observation: null,
      freePass: false,
      vehicleTypeId: vehicleType.id,
    });
    expect(result.resolvedVehicleId).toBe(vehicleId);
  });

  it('aceita LINK criando apenas o vínculo (ambos existem)', async () => {
    const request = buildRequest(AccessRequestType.LINK, {
      vehicleId,
      userId: driverUserId,
    });
    accessRequestRepoMock.findByIdAndCompanyId.mockResolvedValue(request);
    vehicleRepoMock.findByIdAndCompanyId.mockResolvedValue(vehicle);
    userRepoMock.findById.mockResolvedValue(driverUser);
    userVehicleRepoMock.findByUserIdAndVehicleIdAndCompanyId.mockResolvedValue(
      null,
    );
    userVehicleRepoMock.create.mockResolvedValue(link);
    accessRequestRepoMock.updateStatusByIdAndCompanyId.mockResolvedValue(
      buildRequest(AccessRequestType.LINK, {
        vehicleId,
        userId: driverUserId,
        status: AccessRequestStatus.REGISTERED,
        resolvedUserId: driverUserId,
        resolvedVehicleId: vehicleId,
        entryAuthorized: true,
        authorizedBy: admin.id,
      }),
    );

    await useCase.execute(
      admin,
      new AcceptAccessRequestInputDto(request.id, undefined, true, true),
    );

    expect(userRepoMock.create).not.toHaveBeenCalled();
    expect(vehicleRepoMock.create).not.toHaveBeenCalled();
    expect(userVehicleRepoMock.create).toHaveBeenCalledWith({
      companyId: admin.companyId,
      userId: driverUserId,
      vehicleId,
      isPrimary: true,
      canDrive: true,
    });
  });

  it('aceita BOTH criando usuário + veículo + vínculo', async () => {
    const request = buildRequest(AccessRequestType.BOTH, {
      payload: {
        driver: { name: 'Visitante', email: 'visitante@somar.local' },
        vehicle: { model: 'Onix' },
      },
    });
    accessRequestRepoMock.findByIdAndCompanyId.mockResolvedValue(request);
    userRepoMock.findByEmail.mockResolvedValue(null);
    userRepoMock.create.mockResolvedValue(driverUser);
    vehicleTypeRepoMock.findByIdAndCompanyId.mockResolvedValue(vehicleType);
    vehicleRepoMock.findByPlateAndCompanyId.mockResolvedValue(null);
    vehicleRepoMock.create.mockResolvedValue(vehicle);
    userVehicleRepoMock.findByUserIdAndVehicleIdAndCompanyId.mockResolvedValue(
      null,
    );
    userVehicleRepoMock.create.mockResolvedValue(link);
    accessRequestRepoMock.updateStatusByIdAndCompanyId.mockResolvedValue(
      buildRequest(AccessRequestType.BOTH, {
        status: AccessRequestStatus.REGISTERED,
        resolvedUserId: driverUserId,
        resolvedVehicleId: vehicleId,
        entryAuthorized: true,
        authorizedBy: admin.id,
      }),
    );

    const result = await useCase.execute(
      admin,
      new AcceptAccessRequestInputDto(request.id, vehicleType.id, true, false),
    );

    expect(userRepoMock.create).toHaveBeenCalled();
    expect(vehicleRepoMock.create).toHaveBeenCalled();
    expect(userVehicleRepoMock.create).toHaveBeenCalled();
    expect(result.resolvedUserId).toBe(driverUserId);
    expect(result.resolvedVehicleId).toBe(vehicleId);
  });

  it('lança 404 quando a solicitação não existe na empresa', async () => {
    accessRequestRepoMock.findByIdAndCompanyId.mockResolvedValue(null);

    await expect(
      useCase.execute(
        admin,
        new AcceptAccessRequestInputDto('50000000-0000-0000-0000-000000000099'),
      ),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('lança 409 quando a solicitação não está aberta', async () => {
    accessRequestRepoMock.findByIdAndCompanyId.mockResolvedValue(
      buildRequest(AccessRequestType.LINK, {
        vehicleId,
        userId: driverUserId,
        status: AccessRequestStatus.REJECTED,
      }),
    );

    await expect(
      useCase.execute(admin, new AcceptAccessRequestInputDto('x')),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(userRepoMock.create).not.toHaveBeenCalled();
  });

  it('lança 409 para NEW_VEHICLE sem tipo de veículo', async () => {
    const request = buildRequest(AccessRequestType.NEW_VEHICLE, {
      userId: driverUserId,
      payload: { vehicle: { model: 'Onix' } },
    });
    accessRequestRepoMock.findByIdAndCompanyId.mockResolvedValue(request);
    userRepoMock.findById.mockResolvedValue(driverUser);

    await expect(
      useCase.execute(admin, new AcceptAccessRequestInputDto(request.id)),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(vehicleRepoMock.create).not.toHaveBeenCalled();
  });

  it('lança 409 para LINK com vínculo que já permite dirigir', async () => {
    const request = buildRequest(AccessRequestType.LINK, {
      vehicleId,
      userId: driverUserId,
    });
    accessRequestRepoMock.findByIdAndCompanyId.mockResolvedValue(request);
    vehicleRepoMock.findByIdAndCompanyId.mockResolvedValue(vehicle);
    userRepoMock.findById.mockResolvedValue(driverUser);
    userVehicleRepoMock.findByUserIdAndVehicleIdAndCompanyId.mockResolvedValue(
      link as never,
    );

    await expect(
      useCase.execute(admin, new AcceptAccessRequestInputDto(request.id)),
    ).rejects.toThrow('Motorista já autorizado a dirigir este veículo.');
    expect(userVehicleRepoMock.create).not.toHaveBeenCalled();
    expect(userVehicleRepoMock.updateByIdAndCompanyId).not.toHaveBeenCalled();
  });

  it('LINK com vínculo canDrive=false promove a permissão em vez de recusar', async () => {
    const request = buildRequest(AccessRequestType.LINK, {
      vehicleId,
      userId: driverUserId,
    });
    accessRequestRepoMock.findByIdAndCompanyId.mockResolvedValue(request);
    vehicleRepoMock.findByIdAndCompanyId.mockResolvedValue(vehicle);
    userRepoMock.findById.mockResolvedValue(driverUser);
    userVehicleRepoMock.findByUserIdAndVehicleIdAndCompanyId.mockResolvedValue(
      linkWithoutPermission as never,
    );
    userVehicleRepoMock.updateByIdAndCompanyId.mockResolvedValue({
      ...linkWithoutPermission,
      canDrive: true,
    });
    accessRequestRepoMock.updateStatusByIdAndCompanyId.mockResolvedValue(
      buildRequest(AccessRequestType.LINK, {
        vehicleId,
        userId: driverUserId,
        status: AccessRequestStatus.REGISTERED,
        resolvedUserId: driverUserId,
        resolvedVehicleId: vehicleId,
        entryAuthorized: true,
        authorizedBy: admin.id,
      }),
    );

    await useCase.execute(
      admin,
      new AcceptAccessRequestInputDto(request.id, undefined, true, false),
    );

    expect(userVehicleRepoMock.create).not.toHaveBeenCalled();
    expect(userVehicleRepoMock.updateByIdAndCompanyId).toHaveBeenCalledWith(
      link.id,
      admin.companyId,
      { canDrive: true },
    );
  });

  it('LINK com vínculo canDrive=false promove também o primário quando pedido', async () => {
    const request = buildRequest(AccessRequestType.LINK, {
      vehicleId,
      userId: driverUserId,
    });
    accessRequestRepoMock.findByIdAndCompanyId.mockResolvedValue(request);
    vehicleRepoMock.findByIdAndCompanyId.mockResolvedValue(vehicle);
    userRepoMock.findById.mockResolvedValue(driverUser);
    userVehicleRepoMock.findByUserIdAndVehicleIdAndCompanyId.mockResolvedValue(
      linkWithoutPermission as never,
    );
    userVehicleRepoMock.updateByIdAndCompanyId.mockResolvedValue({
      ...linkWithoutPermission,
      canDrive: true,
      isPrimary: true,
    });
    accessRequestRepoMock.updateStatusByIdAndCompanyId.mockResolvedValue(
      buildRequest(AccessRequestType.LINK, {
        vehicleId,
        userId: driverUserId,
        status: AccessRequestStatus.REGISTERED,
        resolvedUserId: driverUserId,
        resolvedVehicleId: vehicleId,
        entryAuthorized: true,
        authorizedBy: admin.id,
      }),
    );

    await useCase.execute(
      admin,
      new AcceptAccessRequestInputDto(request.id, undefined, true, true),
    );

    // O desmarcar do primário anterior é do repositório (1 primário por veículo
    // — ADR 0006 §9); aqui garantimos que a intenção chega até ele.
    expect(userVehicleRepoMock.updateByIdAndCompanyId).toHaveBeenCalledWith(
      link.id,
      admin.companyId,
      { canDrive: true, isPrimary: true },
    );
  });

  it('cenários sem LINK também promovem canDrive quando o vínculo estava false', async () => {
    const request = buildRequest(AccessRequestType.NEW_USER, {
      vehicleId,
      userType: UserType.VISITOR,
      payload: { driver: { name: 'Visitante' } },
    });
    accessRequestRepoMock.findByIdAndCompanyId.mockResolvedValue(request);
    vehicleRepoMock.findByIdAndCompanyId.mockResolvedValue(vehicle);
    userRepoMock.findByEmail.mockResolvedValue(null);
    userRepoMock.create.mockResolvedValue(driverUser);
    userVehicleRepoMock.findByUserIdAndVehicleIdAndCompanyId.mockResolvedValue(
      linkWithoutPermission as never,
    );
    accessRequestRepoMock.updateStatusByIdAndCompanyId.mockResolvedValue(
      buildRequest(AccessRequestType.NEW_USER, {
        vehicleId,
        status: AccessRequestStatus.REGISTERED,
        resolvedUserId: driverUserId,
        resolvedVehicleId: vehicleId,
        entryAuthorized: true,
        authorizedBy: admin.id,
      }),
    );

    await useCase.execute(admin, new AcceptAccessRequestInputDto(request.id));

    expect(userVehicleRepoMock.create).not.toHaveBeenCalled();
    expect(userVehicleRepoMock.updateByIdAndCompanyId).toHaveBeenCalledWith(
      link.id,
      admin.companyId,
      { canDrive: true },
    );
  });

  it('cenários sem LINK mantêm o vínculo já autorizado intacto', async () => {
    const request = buildRequest(AccessRequestType.NEW_USER, {
      vehicleId,
      userType: UserType.VISITOR,
      payload: { driver: { name: 'Visitante' } },
    });
    accessRequestRepoMock.findByIdAndCompanyId.mockResolvedValue(request);
    vehicleRepoMock.findByIdAndCompanyId.mockResolvedValue(vehicle);
    userRepoMock.findByEmail.mockResolvedValue(null);
    userRepoMock.create.mockResolvedValue(driverUser);
    userVehicleRepoMock.findByUserIdAndVehicleIdAndCompanyId.mockResolvedValue(
      link as never,
    );
    accessRequestRepoMock.updateStatusByIdAndCompanyId.mockResolvedValue(
      buildRequest(AccessRequestType.NEW_USER, {
        vehicleId,
        status: AccessRequestStatus.REGISTERED,
        resolvedUserId: driverUserId,
        resolvedVehicleId: vehicleId,
        entryAuthorized: true,
        authorizedBy: admin.id,
      }),
    );

    await expect(
      useCase.execute(
        admin,
        new AcceptAccessRequestInputDto(request.id, undefined, true, true),
      ),
    ).resolves.toBeDefined();

    expect(userVehicleRepoMock.create).not.toHaveBeenCalled();
    expect(userVehicleRepoMock.updateByIdAndCompanyId).not.toHaveBeenCalled();
  });

  it('lança 409 para NEW_USER com e-mail já cadastrado', async () => {
    const request = buildRequest(AccessRequestType.NEW_USER, {
      vehicleId,
      payload: {
        driver: { name: 'Visitante', email: 'visitante@somar.local' },
      },
    });
    accessRequestRepoMock.findByIdAndCompanyId.mockResolvedValue(request);
    vehicleRepoMock.findByIdAndCompanyId.mockResolvedValue(vehicle);
    userRepoMock.findByEmail.mockResolvedValue(driverUser);

    await expect(
      useCase.execute(admin, new AcceptAccessRequestInputDto(request.id)),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(userRepoMock.create).not.toHaveBeenCalled();
  });

  it('aceita NEW_USER VISITOR sem e-mail usando contactPhone como telefone', async () => {
    const request = buildRequest(AccessRequestType.NEW_USER, {
      vehicleId,
      contactPhone: '11888887777',
      payload: { driver: { name: 'Visitante sem e-mail' } },
    });
    accessRequestRepoMock.findByIdAndCompanyId.mockResolvedValue(request);
    vehicleRepoMock.findByIdAndCompanyId.mockResolvedValue(vehicle);
    userRepoMock.create.mockResolvedValue(driverUser);
    accessRequestRepoMock.updateStatusByIdAndCompanyId.mockResolvedValue(
      buildRequest(AccessRequestType.NEW_USER, {
        vehicleId,
        status: AccessRequestStatus.REGISTERED,
        resolvedUserId: driverUserId,
        resolvedVehicleId: vehicleId,
        entryAuthorized: true,
        authorizedBy: admin.id,
      }),
    );

    await useCase.execute(
      admin,
      new AcceptAccessRequestInputDto(request.id, undefined, true, false),
    );

    expect(userRepoMock.findByEmail).not.toHaveBeenCalled();
    expect(userRepoMock.create).toHaveBeenCalledWith(
      expect.objectContaining({
        email: null,
        passwordHash: null,
        phone: '11888887777',
        type: UserType.VISITOR,
      }),
    );
  });

  it('aceita NEW_USER EMPLOYEE com cargo e senha (ADR 0013)', async () => {
    const request = buildRequest(AccessRequestType.NEW_USER, {
      vehicleId,
      userType: UserType.EMPLOYEE,
      payload: {
        driver: { name: 'Colaboradora', email: 'colaboradora@somar.local' },
      },
    });
    accessRequestRepoMock.findByIdAndCompanyId.mockResolvedValue(request);
    vehicleRepoMock.findByIdAndCompanyId.mockResolvedValue(vehicle);
    roleRepoMock.findByIdAndCompanyId.mockResolvedValue(role);
    userRepoMock.findByEmail.mockResolvedValue(null);
    userRepoMock.create.mockResolvedValue(driverUser);
    accessRequestRepoMock.updateStatusByIdAndCompanyId.mockResolvedValue(
      buildRequest(AccessRequestType.NEW_USER, {
        vehicleId,
        userType: UserType.EMPLOYEE,
        status: AccessRequestStatus.REGISTERED,
        resolvedUserId: driverUserId,
        resolvedVehicleId: vehicleId,
        entryAuthorized: true,
        authorizedBy: admin.id,
      }),
    );

    await useCase.execute(
      admin,
      new AcceptAccessRequestInputDto(
        request.id,
        undefined,
        true,
        false,
        undefined,
        role.id,
        'senha-secreta',
      ),
    );

    expect(passwordHashMock.execute).toHaveBeenCalledWith('senha-secreta');
    expect(userRepoMock.create).toHaveBeenCalledWith(
      expect.objectContaining({
        email: 'colaboradora@somar.local',
        passwordHash: 'hash',
        type: UserType.EMPLOYEE,
        roleId: role.id,
      }),
    );
  });

  it('lança 400 para NEW_USER EMPLOYEE sem cargo', async () => {
    const request = buildRequest(AccessRequestType.NEW_USER, {
      vehicleId,
      userType: UserType.EMPLOYEE,
      payload: {
        driver: { name: 'Colaboradora', email: 'colaboradora@somar.local' },
      },
    });
    accessRequestRepoMock.findByIdAndCompanyId.mockResolvedValue(request);
    vehicleRepoMock.findByIdAndCompanyId.mockResolvedValue(vehicle);
    userRepoMock.findByEmail.mockResolvedValue(null);

    await expect(
      useCase.execute(
        admin,
        new AcceptAccessRequestInputDto(
          request.id,
          undefined,
          true,
          false,
          undefined,
          undefined,
          'senha-secreta',
        ),
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(userRepoMock.create).not.toHaveBeenCalled();
  });

  it('lança 400 para NEW_USER EMPLOYEE sem senha', async () => {
    const request = buildRequest(AccessRequestType.NEW_USER, {
      vehicleId,
      userType: UserType.EMPLOYEE,
      payload: {
        driver: { name: 'Colaboradora', email: 'colaboradora@somar.local' },
      },
    });
    accessRequestRepoMock.findByIdAndCompanyId.mockResolvedValue(request);
    vehicleRepoMock.findByIdAndCompanyId.mockResolvedValue(vehicle);
    roleRepoMock.findByIdAndCompanyId.mockResolvedValue(role);
    userRepoMock.findByEmail.mockResolvedValue(null);

    await expect(
      useCase.execute(
        admin,
        new AcceptAccessRequestInputDto(
          request.id,
          undefined,
          true,
          false,
          undefined,
          role.id,
        ),
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(userRepoMock.create).not.toHaveBeenCalled();
  });

  it('lança 404 para NEW_USER EMPLOYEE com cargo inexistente', async () => {
    const request = buildRequest(AccessRequestType.NEW_USER, {
      vehicleId,
      userType: UserType.EMPLOYEE,
      payload: {
        driver: { name: 'Colaboradora', email: 'colaboradora@somar.local' },
      },
    });
    accessRequestRepoMock.findByIdAndCompanyId.mockResolvedValue(request);
    vehicleRepoMock.findByIdAndCompanyId.mockResolvedValue(vehicle);
    roleRepoMock.findByIdAndCompanyId.mockResolvedValue(null);
    userRepoMock.findByEmail.mockResolvedValue(null);

    await expect(
      useCase.execute(
        admin,
        new AcceptAccessRequestInputDto(
          request.id,
          undefined,
          true,
          false,
          undefined,
          role.id,
          'senha-secreta',
        ),
      ),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(userRepoMock.create).not.toHaveBeenCalled();
  });
});
