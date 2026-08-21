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
  AccessRequestStatus,
  AccessRequestType,
  ContactChannel,
} from '../../domain/constants/access-request.constant';

// Types
import type { AuthenticatedUserEntity } from '../../../auth/domain/entities/authenticated-user.entity';
import type { AccessRequestEntity } from '../../domain/entities/access-request.entity';
import type { VehicleWithTypeEntity } from '../../../vehicles/domain/entities/vehicle.entity';
import type { DepartmentEntity } from '../../../departments/domain/entities/department.entity';
import type { UserEntity } from '../../../users/domain/entities/user.entity';
import type { AccessRequestRepository } from '../../domain/repositories/access-request.repository';
import type { VehicleRepository } from '../../../vehicles/domain/repositories/vehicle.repository';
import type { UserRepository } from '../../../users/domain/repositories/user.repository';
import type { UserCompanyRepository } from '../../../auth/domain/repositories/user-company.repository';
import type { DepartmentRepository } from '../../../departments/domain/repositories/department.repository';

// Repositories
import { ACCESS_REQUEST_REPOSITORY } from '../../domain/repositories/access-request.repository';
import { VEHICLE_REPOSITORY } from '../../../vehicles/domain/repositories/vehicle.repository';
import { USER_REPOSITORY } from '../../../users/domain/repositories/user.repository';
import { USER_COMPANY_REPOSITORY } from '../../../auth/domain/repositories/user-company.repository';
import { DEPARTMENT_REPOSITORY } from '../../../departments/domain/repositories/department.repository';

// DTOs
import { CreateAccessRequestInputDto } from '../../application/dto/create-access-request-input.dto';

// Use case
import { CreateAccessRequestUseCase } from '../../application/use-cases/create-access-request.use-case';

describe('CreateAccessRequestUseCase', () => {
  let useCase: CreateAccessRequestUseCase;

  const accessRequestRepoMock = {
    findOpenByPlateAndCompanyId: jest.fn(),
    create: jest.fn(),
  } as jest.Mocked<
    Pick<AccessRequestRepository, 'findOpenByPlateAndCompanyId' | 'create'>
  >;

  const vehicleRepoMock = {
    findByIdAndCompanyId: jest.fn(),
  } as jest.Mocked<Pick<VehicleRepository, 'findByIdAndCompanyId'>>;

  const userRepoMock = {
    findByEmail: jest.fn(),
  } as jest.Mocked<Pick<UserRepository, 'findByEmail'>>;

  const userCompanyRepoMock = {
    findByUserIdAndCompanyId: jest.fn(),
  } as jest.Mocked<Pick<UserCompanyRepository, 'findByUserIdAndCompanyId'>>;

  const departmentRepoMock = {
    findByIdAndCompanyId: jest.fn(),
  } as jest.Mocked<Pick<DepartmentRepository, 'findByIdAndCompanyId'>>;

  const actor: AuthenticatedUserEntity = {
    id: '30000000-0000-0000-0000-000000000002',
    companyId: '10000000-0000-0000-0000-000000000001',
    email: 'porteiro@somar.local',
    name: 'Porteiro Silva',
    type: UserType.EMPLOYEE,
    isAdmin: false,
    roleCodes: ['Portaria'],
    permissions: [PermissionCode.CREATE_ACCESS_REQUEST],
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
    createdAt: new Date('2026-08-21T00:00:00Z'),
    updatedAt: new Date('2026-08-21T00:00:00Z'),
    vehicleType: {
      id: '40000000-0000-0000-0000-000000000001',
      code: 'FROTA',
      name: 'Frota',
      isFleet: true,
    },
  };

  const department: DepartmentEntity = {
    id: '40000000-0000-0000-0000-000000000002',
    companyId: actor.companyId,
    name: 'Recepção',
    description: null,
    parkingSpace: 10,
    isActive: true,
    createdAt: new Date('2026-08-21T00:00:00Z'),
    updatedAt: new Date('2026-08-21T00:00:00Z'),
  };

  const existingUser: UserEntity = {
    id: '30000000-0000-0000-0000-000000000005',
    name: 'Motorista',
    email: 'motorista@somar.local',
    passwordHash: 'hash',
    phone: null,
    document: null,
    photoUrl: null,
    lastLoginAt: null,
    createdAt: new Date('2026-08-21T00:00:00Z'),
    updatedAt: new Date('2026-08-21T00:00:00Z'),
  };

  const request: AccessRequestEntity = {
    id: '50000000-0000-0000-0000-000000000001',
    companyId: actor.companyId,
    idempotencyKey: 'req-123',
    type: AccessRequestType.NEW_USER,
    plate: vehicle.plate,
    vehicleId: vehicle.id,
    userId: null,
    status: AccessRequestStatus.PENDING,
    entryAuthorized: false,
    authorizedBy: null,
    authorizedAt: null,
    requestedBy: actor.id,
    requestedAt: new Date('2026-08-24T11:00:00Z'),
    handledBy: null,
    handledAt: null,
    contactChannel: ContactChannel.WHATSAPP,
    contactPhone: '11999999999',
    departmentId: department.id,
    payload: {
      driver: { name: 'Visitante', email: 'visitante@somar.local' },
    },
    statusHistory: [
      {
        status: AccessRequestStatus.PENDING,
        at: '2026-08-24T11:00:00Z',
        by: actor.id,
      },
    ],
    resolvedUserId: null,
    resolvedVehicleId: null,
    observation: null,
    createdAt: new Date('2026-08-24T11:00:00Z'),
    updatedAt: new Date('2026-08-24T11:00:00Z'),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module = await Test.createTestingModule({
      providers: [
        CreateAccessRequestUseCase,
        { provide: ACCESS_REQUEST_REPOSITORY, useValue: accessRequestRepoMock },
        { provide: VEHICLE_REPOSITORY, useValue: vehicleRepoMock },
        { provide: USER_REPOSITORY, useValue: userRepoMock },
        { provide: USER_COMPANY_REPOSITORY, useValue: userCompanyRepoMock },
        { provide: DEPARTMENT_REPOSITORY, useValue: departmentRepoMock },
      ],
    }).compile();
    useCase = module.get(CreateAccessRequestUseCase);
  });

  it('cria solicitação NEW_USER com veículo existente, contato e departamento', async () => {
    vehicleRepoMock.findByIdAndCompanyId.mockResolvedValue(vehicle);
    departmentRepoMock.findByIdAndCompanyId.mockResolvedValue(department);
    userRepoMock.findByEmail.mockResolvedValue(null);
    accessRequestRepoMock.findOpenByPlateAndCompanyId.mockResolvedValue(null);
    accessRequestRepoMock.create.mockResolvedValue(request);

    const result = await useCase.execute(
      actor,
      new CreateAccessRequestInputDto(
        'ABC1D23',
        AccessRequestType.NEW_USER,
        vehicle.id,
        undefined,
        ContactChannel.WHATSAPP,
        '11999999999',
        department.id,
        { driver: { name: 'Visitante', email: 'visitante@somar.local' } },
      ),
    );

    expect(accessRequestRepoMock.create).toHaveBeenCalledWith(
      expect.objectContaining({
        companyId: actor.companyId,
        type: AccessRequestType.NEW_USER,
        plate: 'ABC1D23',
        vehicleId: vehicle.id,
        requestedBy: actor.id,
        contactChannel: ContactChannel.WHATSAPP,
        contactPhone: '11999999999',
        departmentId: department.id,
      }),
    );
    // idempotency_key gerada no servidor.
    const call = accessRequestRepoMock.create.mock.calls[0][0];
    expect(call.idempotencyKey).toEqual(expect.any(String));
    expect(result.status).toBe(AccessRequestStatus.PENDING);
    expect(result.requestedBy).toEqual({ id: actor.id, name: actor.name });
  });

  it('lança 400 para placa inválida', async () => {
    await expect(
      useCase.execute(
        actor,
        new CreateAccessRequestInputDto('ABC12', AccessRequestType.LINK),
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(accessRequestRepoMock.create).not.toHaveBeenCalled();
  });

  it('lança 400 para NEW_USER sem veículo', async () => {
    await expect(
      useCase.execute(
        actor,
        new CreateAccessRequestInputDto('ABC1D23', AccessRequestType.NEW_USER),
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('lança 404 para NEW_USER com veículo de outra empresa', async () => {
    vehicleRepoMock.findByIdAndCompanyId.mockResolvedValue(null);

    await expect(
      useCase.execute(
        actor,
        new CreateAccessRequestInputDto(
          'ABC1D23',
          AccessRequestType.NEW_USER,
          vehicle.id,
          undefined,
          ContactChannel.WHATSAPP,
          '11999999999',
        ),
      ),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('lança 400 para NEW_USER sem nome do motorista no payload', async () => {
    vehicleRepoMock.findByIdAndCompanyId.mockResolvedValue(vehicle);

    await expect(
      useCase.execute(
        actor,
        new CreateAccessRequestInputDto(
          'ABC1D23',
          AccessRequestType.NEW_USER,
          vehicle.id,
          undefined,
          ContactChannel.WHATSAPP,
          '11999999999',
        ),
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('lança 400 para NEW_USER sem telefone de contato (regra 43)', async () => {
    vehicleRepoMock.findByIdAndCompanyId.mockResolvedValue(vehicle);

    await expect(
      useCase.execute(
        actor,
        new CreateAccessRequestInputDto(
          'ABC1D23',
          AccessRequestType.NEW_USER,
          vehicle.id,
          undefined,
          undefined,
          undefined,
          undefined,
          { driver: { name: 'Visitante', email: 'visitante@somar.local' } },
        ),
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('lança 404 para departamento inexistente (regra 46)', async () => {
    vehicleRepoMock.findByIdAndCompanyId.mockResolvedValue(vehicle);
    departmentRepoMock.findByIdAndCompanyId.mockResolvedValue(null);

    await expect(
      useCase.execute(
        actor,
        new CreateAccessRequestInputDto(
          'ABC1D23',
          AccessRequestType.NEW_USER,
          vehicle.id,
          undefined,
          ContactChannel.WHATSAPP,
          '11999999999',
          department.id,
          { driver: { name: 'Visitante', email: 'visitante@somar.local' } },
        ),
      ),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('lança 409 para e-mail já cadastrado (fail-fast)', async () => {
    vehicleRepoMock.findByIdAndCompanyId.mockResolvedValue(vehicle);
    userRepoMock.findByEmail.mockResolvedValue(existingUser);

    await expect(
      useCase.execute(
        actor,
        new CreateAccessRequestInputDto(
          'ABC1D23',
          AccessRequestType.NEW_USER,
          vehicle.id,
          undefined,
          ContactChannel.WHATSAPP,
          '11999999999',
          undefined,
          { driver: { name: 'Visitante', email: 'motorista@somar.local' } },
        ),
      ),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(accessRequestRepoMock.create).not.toHaveBeenCalled();
  });

  it('lança 409 para solicitação aberta duplicada da placa (unique parcial)', async () => {
    vehicleRepoMock.findByIdAndCompanyId.mockResolvedValue(vehicle);
    userRepoMock.findByEmail.mockResolvedValue(null);
    accessRequestRepoMock.findOpenByPlateAndCompanyId.mockResolvedValue(
      request,
    );

    await expect(
      useCase.execute(
        actor,
        new CreateAccessRequestInputDto(
          'ABC1D23',
          AccessRequestType.NEW_USER,
          vehicle.id,
          undefined,
          ContactChannel.WHATSAPP,
          '11999999999',
          undefined,
          { driver: { name: 'Visitante', email: 'visitante@somar.local' } },
        ),
      ),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(accessRequestRepoMock.create).not.toHaveBeenCalled();
  });

  it('lança 400 para LINK sem veículo e usuário', async () => {
    await expect(
      useCase.execute(
        actor,
        new CreateAccessRequestInputDto('ABC1D23', AccessRequestType.LINK),
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('valida NEW_VEHICLE com usuário existente na empresa (sem contato → 400)', async () => {
    userCompanyRepoMock.findByUserIdAndCompanyId.mockResolvedValue({
      id: '60000000-0000-0000-0000-000000000001',
      userId: existingUser.id,
      companyId: actor.companyId,
      type: UserType.EMPLOYEE,
      isActive: true,
      createdAt: new Date('2026-08-21T00:00:00Z'),
      updatedAt: new Date('2026-08-21T00:00:00Z'),
    } as never);

    await expect(
      useCase.execute(
        actor,
        new CreateAccessRequestInputDto(
          'ABC1D23',
          AccessRequestType.NEW_VEHICLE,
          undefined,
          existingUser.id,
          undefined,
          undefined,
          undefined,
          { vehicle: { model: 'Onix' } },
        ),
      ),
    ).rejects.toBeInstanceOf(BadRequestException); // sem contato
    expect(userCompanyRepoMock.findByUserIdAndCompanyId).toHaveBeenCalledWith(
      existingUser.id,
      actor.companyId,
    );
  });
});
