// NestJS
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
import { ListBlockRequestsInputDto } from '../../application/dto/list-block-requests-input.dto';

// Use case
import { ListBlockRequestsUseCase } from '../../application/use-cases/list-block-requests.use-case';

describe('ListBlockRequestsUseCase', () => {
  let useCase: ListBlockRequestsUseCase;

  const blockRequestRepoMock = {
    list: jest.fn(),
  } as jest.Mocked<Pick<BlockRequestRepository, 'list'>>;

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

  const pending: BlockRequestEntity = {
    id: '50000000-0000-0000-0000-000000000020',
    companyId: admin.companyId,
    vehicleId: '40000000-0000-0000-0000-000000000010',
    plate: 'ABC1D23',
    reason: 'Veículo com condutor suspeito',
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

  const approved: BlockRequestEntity = {
    ...pending,
    id: '50000000-0000-0000-0000-000000000021',
    status: BlockRequestStatus.APPROVED,
    handledBy: admin.id,
    handledAt: new Date('2026-08-24T12:00:00Z'),
    resolvedBlockId: '50000000-0000-0000-0000-000000000001',
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module = await Test.createTestingModule({
      providers: [
        ListBlockRequestsUseCase,
        { provide: BLOCK_REQUEST_REPOSITORY, useValue: blockRequestRepoMock },
        { provide: USER_REPOSITORY, useValue: userRepoMock },
      ],
    }).compile();
    useCase = module.get(ListBlockRequestsUseCase);
  });

  it('lista solicitações no formato padrão resolvendo atores em lote', async () => {
    blockRequestRepoMock.list.mockResolvedValue({
      data: [pending, approved],
      count: 2,
    });
    userRepoMock.findById.mockResolvedValue(doormanUser);

    const result = await useCase.execute(
      admin,
      new ListBlockRequestsInputDto(BlockRequestStatus.PENDING, 10, 0),
    );

    expect(blockRequestRepoMock.list).toHaveBeenCalledWith(admin.companyId, {
      status: BlockRequestStatus.PENDING,
      limit: 10,
      offset: 0,
    });
    // ids distintos: requested_by (2) + handled_by (1) = 2 findById.
    expect(userRepoMock.findById).toHaveBeenCalledTimes(2);
    expect(result.count).toBe(2);
    expect(result.data[0].requestedBy).toEqual({
      id: doormanUser.id,
      name: doormanUser.name,
    });
    expect(result.data[0].handledBy).toBeNull();
    // handled_by do aprovado não resolvido (admin não está no mock) → null.
    expect(result.data[1].handledBy).toBeNull();
  });

  it('retorna página vazia quando não há solicitações', async () => {
    blockRequestRepoMock.list.mockResolvedValue({ data: [], count: 0 });

    const result = await useCase.execute(
      admin,
      new ListBlockRequestsInputDto(undefined, 20, 0),
    );

    expect(result.data).toEqual([]);
    expect(result.count).toBe(0);
  });
});
