// NestJS
import {
  ConflictException,
  ForbiddenException,
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
import type { UserEntity } from '../../../users/domain/entities/user.entity';
import type { AccessRequestRepository } from '../../domain/repositories/access-request.repository';
import type { UserRepository } from '../../../users/domain/repositories/user.repository';

// Repositories
import { ACCESS_REQUEST_REPOSITORY } from '../../domain/repositories/access-request.repository';
import { USER_REPOSITORY } from '../../../users/domain/repositories/user.repository';

// DTOs
import { HandleAccessRequestInputDto } from '../../application/dto/handle-access-request-input.dto';

// Use case
import { CancelAccessRequestUseCase } from '../../application/use-cases/cancel-access-request.use-case';

describe('CancelAccessRequestUseCase', () => {
  let useCase: CancelAccessRequestUseCase;

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
  } as jest.Mocked<Pick<UserRepository, 'findById'>>;

  const doorman: AuthenticatedUserEntity = {
    id: '30000000-0000-0000-0000-000000000002',
    companyId: '10000000-0000-0000-0000-000000000001',
    email: 'porteiro@somar.local',
    name: 'Porteiro Silva',
    type: UserType.EMPLOYEE,
    isAdmin: false,
    roleCodes: ['Portaria'],
    permissions: [PermissionCode.CANCEL_ACCESS_REQUEST],
  };

  const otherDoorman: AuthenticatedUserEntity = {
    ...doorman,
    id: '30000000-0000-0000-0000-000000000003',
    email: 'porteiros@somar.local',
    name: 'Porteiro Souza',
  };

  const doormanUser: UserEntity = {
    id: doorman.id,
    name: doorman.name,
    email: doorman.email,
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
    companyId: doorman.companyId,
    idempotencyKey: 'req-1',
    type: AccessRequestType.NEW_VEHICLE,
    plate: 'XYZ9A99',
    vehicleId: null,
    userId: doorman.id,
    status: AccessRequestStatus.PENDING,
    entryAuthorized: false,
    authorizedBy: null,
    authorizedAt: null,
    requestedBy: doorman.id,
    requestedAt: new Date('2026-08-24T11:00:00Z'),
    handledBy: null,
    handledAt: null,
    contactChannel: ContactChannel.WHATSAPP,
    contactPhone: '11999999999',
    departmentId: null,
    payload: { vehicle: { model: 'Onix' } },
    statusHistory: [],
    resolvedUserId: null,
    resolvedVehicleId: null,
    observation: null,
    createdAt: new Date('2026-08-24T11:00:00Z'),
    updatedAt: new Date('2026-08-24T11:00:00Z'),
  };

  const cancelled: AccessRequestEntity = {
    ...request,
    status: AccessRequestStatus.CANCELLED,
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module = await Test.createTestingModule({
      providers: [
        CancelAccessRequestUseCase,
        { provide: ACCESS_REQUEST_REPOSITORY, useValue: accessRequestRepoMock },
        { provide: USER_REPOSITORY, useValue: userRepoMock },
      ],
    }).compile();
    useCase = module.get(CancelAccessRequestUseCase);
  });

  it('cancela a própria solicitação pendente', async () => {
    accessRequestRepoMock.findByIdAndCompanyId.mockResolvedValue(request);
    accessRequestRepoMock.updateStatusByIdAndCompanyId.mockResolvedValue(
      cancelled,
    );
    userRepoMock.findById.mockResolvedValue(doormanUser);

    const result = await useCase.execute(
      doorman,
      new HandleAccessRequestInputDto(request.id),
    );

    expect(
      accessRequestRepoMock.updateStatusByIdAndCompanyId,
    ).toHaveBeenCalledWith(request.id, doorman.companyId, {
      status: AccessRequestStatus.CANCELLED,
    });
    expect(result.status).toBe(AccessRequestStatus.CANCELLED);
    expect(result.handledBy).toBeNull();
  });

  it('lança 403 ao cancelar solicitação de outro porteiro', async () => {
    accessRequestRepoMock.findByIdAndCompanyId.mockResolvedValue(request);

    await expect(
      useCase.execute(
        otherDoorman,
        new HandleAccessRequestInputDto(request.id),
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(
      accessRequestRepoMock.updateStatusByIdAndCompanyId,
    ).not.toHaveBeenCalled();
  });

  it('lança 404 quando a solicitação não existe na empresa', async () => {
    accessRequestRepoMock.findByIdAndCompanyId.mockResolvedValue(null);

    await expect(
      useCase.execute(doorman, new HandleAccessRequestInputDto(request.id)),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('lança 409 quando a solicitação não está pendente', async () => {
    accessRequestRepoMock.findByIdAndCompanyId.mockResolvedValue(cancelled);

    await expect(
      useCase.execute(doorman, new HandleAccessRequestInputDto(request.id)),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(
      accessRequestRepoMock.updateStatusByIdAndCompanyId,
    ).not.toHaveBeenCalled();
  });
});
