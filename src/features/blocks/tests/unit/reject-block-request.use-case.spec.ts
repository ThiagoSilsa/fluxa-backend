// NestJS
import { ConflictException, NotFoundException } from '@nestjs/common';
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
import { RejectBlockRequestUseCase } from '../../application/use-cases/reject-block-request.use-case';

describe('RejectBlockRequestUseCase', () => {
  let useCase: RejectBlockRequestUseCase;

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

  const admin: AuthenticatedUserEntity = {
    id: '30000000-0000-0000-0000-000000000001',
    companyId: '10000000-0000-0000-0000-000000000001',
    email: 'admin@somar.local',
    name: 'Administrador',
    type: UserType.EMPLOYEE,
    isAdmin: true,
    roleCodes: ['Administração'],
    permissions: [PermissionCode.MANAGE_BLOCKS],
  };

  const doormanUser: UserEntity = {
    id: '30000000-0000-0000-0000-000000000002',
    name: 'Porteiro Silva',
    email: 'porteiro@somar.local',
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
    companyId: admin.companyId,
    vehicleId: null,
    plate: 'XYZ9A99',
    reason: 'Placa suspeita',
    status: BlockRequestStatus.PENDING,
    requestedBy: doormanUser.id,
    requestedAt: new Date('2026-08-24T11:00:00Z'),
    handledBy: null,
    handledAt: null,
    observation: null,
    statusHistory: [
      {
        status: BlockRequestStatus.PENDING,
        at: '2026-08-24T11:00:00Z',
        by: doormanUser.id,
      },
    ],
    resolvedBlockId: null,
    syncStatus: SyncStatus.SYNCED,
    idempotencyKey: 'req-123',
    createdAt: new Date('2026-08-24T11:00:00Z'),
    updatedAt: new Date('2026-08-24T11:00:00Z'),
  };

  const rejected: BlockRequestEntity = {
    ...request,
    status: BlockRequestStatus.REJECTED,
    handledBy: admin.id,
    handledAt: new Date('2026-08-24T12:00:00Z'),
    observation: 'Não confirmado',
    statusHistory: [
      ...request.statusHistory,
      {
        status: BlockRequestStatus.REJECTED,
        at: '2026-08-24T12:00:00Z',
        by: admin.id,
      },
    ],
    updatedAt: new Date('2026-08-24T12:00:00Z'),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module = await Test.createTestingModule({
      providers: [
        RejectBlockRequestUseCase,
        { provide: BLOCK_REQUEST_REPOSITORY, useValue: blockRequestRepoMock },
        { provide: USER_REPOSITORY, useValue: userRepoMock },
      ],
    }).compile();
    useCase = module.get(RejectBlockRequestUseCase);
  });

  it('rejeita a solicitação pendente (sem criar bloqueio)', async () => {
    blockRequestRepoMock.findByIdAndCompanyId.mockResolvedValue(request);
    blockRequestRepoMock.updateStatusByIdAndCompanyId.mockResolvedValue(
      rejected,
    );
    userRepoMock.findById.mockResolvedValue(doormanUser);

    const result = await useCase.execute(
      admin,
      new HandleBlockRequestInputDto(request.id, 'Não confirmado'),
    );

    expect(
      blockRequestRepoMock.updateStatusByIdAndCompanyId,
    ).toHaveBeenCalledWith(request.id, admin.companyId, {
      status: BlockRequestStatus.REJECTED,
      handledBy: admin.id,
      observation: 'Não confirmado',
    });
    expect(result.status).toBe(BlockRequestStatus.REJECTED);
    expect(result.handledBy).toEqual({ id: admin.id, name: admin.name });
  });

  it('lança 404 quando a solicitação não existe na empresa', async () => {
    blockRequestRepoMock.findByIdAndCompanyId.mockResolvedValue(null);

    await expect(
      useCase.execute(admin, new HandleBlockRequestInputDto(request.id)),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(
      blockRequestRepoMock.updateStatusByIdAndCompanyId,
    ).not.toHaveBeenCalled();
  });

  it('lança 409 quando a solicitação não está pendente', async () => {
    blockRequestRepoMock.findByIdAndCompanyId.mockResolvedValue(rejected);

    await expect(
      useCase.execute(admin, new HandleBlockRequestInputDto(request.id)),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(
      blockRequestRepoMock.updateStatusByIdAndCompanyId,
    ).not.toHaveBeenCalled();
  });
});
