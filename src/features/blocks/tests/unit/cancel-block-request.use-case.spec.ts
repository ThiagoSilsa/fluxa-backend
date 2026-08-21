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
  BlockRequestStatus,
  SyncStatus,
} from '../../domain/constants/block.constant';

// Types
import type { AuthenticatedUserEntity } from '../../../auth/domain/entities/authenticated-user.entity';
import type { BlockRequestEntity } from '../../domain/entities/block-request.entity';
import type { UserEntity } from '../../../users/domain/entities/user.entity';
import type { BlockRequestRepository } from '../../domain/repositories/block-request.repository';
import type { UserRepository } from '../../../users/domain/repositories/user.repository';

// Repositories
import { BLOCK_REQUEST_REPOSITORY } from '../../domain/repositories/block-request.repository';
import { USER_REPOSITORY } from '../../../users/domain/repositories/user.repository';

// DTOs
import { HandleBlockRequestInputDto } from '../../application/dto/list-block-requests-input.dto';

// Use case
import { CancelBlockRequestUseCase } from '../../application/use-cases/cancel-block-request.use-case';

describe('CancelBlockRequestUseCase', () => {
  let useCase: CancelBlockRequestUseCase;

  const blockRequestRepoMock = {
    findByIdAndCompanyId: jest.fn(),
    updateStatusByIdAndCompanyId: jest.fn(),
  } as jest.Mocked<
    Pick<
      BlockRequestRepository,
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
    permissions: [PermissionCode.CREATE_BLOCK_REQUEST],
  };

  const otherDoorman: AuthenticatedUserEntity = {
    ...doorman,
    id: '30000000-0000-0000-0000-000000000003',
    name: 'Porteiro Souza',
    email: 'porteiros@somar.local',
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

  const request: BlockRequestEntity = {
    id: '50000000-0000-0000-0000-000000000020',
    companyId: doorman.companyId,
    vehicleId: null,
    plate: 'XYZ9A99',
    reason: 'Placa suspeita',
    status: BlockRequestStatus.PENDING,
    requestedBy: doorman.id,
    requestedAt: new Date('2026-08-24T11:00:00Z'),
    handledBy: null,
    handledAt: null,
    observation: null,
    statusHistory: [
      {
        status: BlockRequestStatus.PENDING,
        at: '2026-08-24T11:00:00Z',
        by: doorman.id,
      },
    ],
    resolvedBlockId: null,
    syncStatus: SyncStatus.SYNCED,
    idempotencyKey: 'req-123',
    createdAt: new Date('2026-08-24T11:00:00Z'),
    updatedAt: new Date('2026-08-24T11:00:00Z'),
  };

  const cancelled: BlockRequestEntity = {
    ...request,
    status: BlockRequestStatus.CANCELLED,
    statusHistory: [
      ...request.statusHistory,
      {
        status: BlockRequestStatus.CANCELLED,
        at: '2026-08-24T11:30:00Z',
        by: doorman.id,
      },
    ],
    updatedAt: new Date('2026-08-24T11:30:00Z'),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module = await Test.createTestingModule({
      providers: [
        CancelBlockRequestUseCase,
        { provide: BLOCK_REQUEST_REPOSITORY, useValue: blockRequestRepoMock },
        { provide: USER_REPOSITORY, useValue: userRepoMock },
      ],
    }).compile();
    useCase = module.get(CancelBlockRequestUseCase);
  });

  it('cancela a própria solicitação pendente', async () => {
    blockRequestRepoMock.findByIdAndCompanyId.mockResolvedValue(request);
    blockRequestRepoMock.updateStatusByIdAndCompanyId.mockResolvedValue(
      cancelled,
    );
    userRepoMock.findById.mockResolvedValue(doormanUser);

    const result = await useCase.execute(
      doorman,
      new HandleBlockRequestInputDto(request.id),
    );

    expect(
      blockRequestRepoMock.updateStatusByIdAndCompanyId,
    ).toHaveBeenCalledWith(request.id, doorman.companyId, {
      status: BlockRequestStatus.CANCELLED,
    });
    expect(result.status).toBe(BlockRequestStatus.CANCELLED);
    expect(result.handledBy).toBeNull();
  });

  it('lança 403 ao tentar cancelar solicitação de outro porteiro', async () => {
    blockRequestRepoMock.findByIdAndCompanyId.mockResolvedValue(request);

    await expect(
      useCase.execute(otherDoorman, new HandleBlockRequestInputDto(request.id)),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(
      blockRequestRepoMock.updateStatusByIdAndCompanyId,
    ).not.toHaveBeenCalled();
  });

  it('lança 404 quando a solicitação não existe na empresa', async () => {
    blockRequestRepoMock.findByIdAndCompanyId.mockResolvedValue(null);

    await expect(
      useCase.execute(doorman, new HandleBlockRequestInputDto(request.id)),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('lança 409 quando a solicitação não está pendente', async () => {
    blockRequestRepoMock.findByIdAndCompanyId.mockResolvedValue(cancelled);

    await expect(
      useCase.execute(doorman, new HandleBlockRequestInputDto(request.id)),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(
      blockRequestRepoMock.updateStatusByIdAndCompanyId,
    ).not.toHaveBeenCalled();
  });
});
