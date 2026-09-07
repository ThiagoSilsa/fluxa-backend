// NestJS
import { NotFoundException } from '@nestjs/common';
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
import { GetBlockRequestUseCase } from '../../application/use-cases/get-block-request.use-case';

describe('GetBlockRequestUseCase', () => {
  let useCase: GetBlockRequestUseCase;

  const blockRequestRepoMock = {
    findByIdAndCompanyId: jest.fn(),
  } as jest.Mocked<Pick<BlockRequestRepository, 'findByIdAndCompanyId'>>;

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
    id: '50000000-0000-0000-0000-000000000030',
    companyId: admin.companyId,
    vehicleId: '40000000-0000-0000-0000-000000000010',
    plate: 'ABC1D23',
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
    idempotencyKey: 'req-456',
    createdAt: new Date('2026-08-24T11:00:00Z'),
    updatedAt: new Date('2026-08-24T11:00:00Z'),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module = await Test.createTestingModule({
      providers: [
        GetBlockRequestUseCase,
        { provide: BLOCK_REQUEST_REPOSITORY, useValue: blockRequestRepoMock },
        { provide: USER_REPOSITORY, useValue: userRepoMock },
      ],
    }).compile();
    useCase = module.get(GetBlockRequestUseCase);
  });

  it('detalha solicitação resolvendo requested_by (gestor)', async () => {
    blockRequestRepoMock.findByIdAndCompanyId.mockResolvedValue(request);
    userRepoMock.findById.mockResolvedValue(doormanUser);

    const result = await useCase.execute(
      admin,
      new HandleBlockRequestInputDto(request.id),
    );

    expect(blockRequestRepoMock.findByIdAndCompanyId).toHaveBeenCalledWith(
      request.id,
      admin.companyId,
    );
    expect(result.requestedBy).toEqual({
      id: doormanUser.id,
      name: doormanUser.name,
    });
    expect(result.handledBy).toBeNull();
  });

  it('solicitante (porteiro) detalha apenas a própria solicitação', async () => {
    const porteiro: AuthenticatedUserEntity = {
      id: doormanUser.id,
      companyId: admin.companyId,
      email: 'porteiro@somar.local',
      name: 'Porteiro Silva',
      type: UserType.EMPLOYEE,
      isAdmin: false,
      roleCodes: ['Portaria'],
      permissions: [PermissionCode.CREATE_BLOCK_REQUEST],
    };
    blockRequestRepoMock.findByIdAndCompanyId.mockResolvedValue(request);
    userRepoMock.findById.mockResolvedValue(doormanUser);

    const result = await useCase.execute(
      porteiro,
      new HandleBlockRequestInputDto(request.id),
    );

    expect(blockRequestRepoMock.findByIdAndCompanyId).toHaveBeenCalledWith(
      request.id,
      porteiro.companyId,
    );
    expect(result.requestedBy).toEqual({
      id: doormanUser.id,
      name: doormanUser.name,
    });
  });

  it('solicitante recebe 404 ao detalhar solicitação de OUTRO porteiro', async () => {
    const outroPorteiro: AuthenticatedUserEntity = {
      id: '30000000-0000-0000-0000-000000000004',
      companyId: admin.companyId,
      email: 'outro@somar.local',
      name: 'Outro Porteiro',
      type: UserType.EMPLOYEE,
      isAdmin: false,
      roleCodes: ['Portaria'],
      permissions: [PermissionCode.CREATE_BLOCK_REQUEST],
    };
    blockRequestRepoMock.findByIdAndCompanyId.mockResolvedValue(request);

    await expect(
      useCase.execute(
        outroPorteiro,
        new HandleBlockRequestInputDto(request.id),
      ),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(userRepoMock.findById).not.toHaveBeenCalled();
  });

  it('lança 404 quando a solicitação não existe na empresa (cross-tenant oculto)', async () => {
    blockRequestRepoMock.findByIdAndCompanyId.mockResolvedValue(null);

    await expect(
      useCase.execute(admin, new HandleBlockRequestInputDto(request.id)),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(userRepoMock.findById).not.toHaveBeenCalled();
  });
});
