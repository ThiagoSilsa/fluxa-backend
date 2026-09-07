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
  VehicleBlockStatus,
  VehicleBlockType,
} from '../../domain/constants/block.constant';

// Types
import type { AuthenticatedUserEntity } from '../../../auth/domain/entities/authenticated-user.entity';
import type { BlockRequestEntity } from '../../domain/entities/block-request.entity';
import type { VehicleBlockEntity } from '../../domain/entities/vehicle-block.entity';
import type { UserEntity } from '../../../users/domain/entities/user.entity';
import type { BlockRequestRepository } from '../../domain/repositories/block-request.repository';
import type { UserRepository } from '../../../users/domain/repositories/user.repository';

// Repositories
import { BLOCK_REQUEST_REPOSITORY } from '../../domain/repositories/block-request.repository';
import { USER_REPOSITORY } from '../../../users/domain/repositories/user.repository';

// DTOs
import { HandleBlockRequestInputDto } from '../../application/dto/list-block-requests-input.dto';

// Use cases
import { ApproveBlockRequestUseCase } from '../../application/use-cases/approve-block-request.use-case';
import { CreateVehicleBlockUseCase } from '../../application/use-cases/create-vehicle-block.use-case';

// Repositories extras para o CreateVehicleBlockUseCase
import { VEHICLE_BLOCK_REPOSITORY } from '../../domain/repositories/vehicle-block.repository';
import { VEHICLE_REPOSITORY } from '../../../vehicles/domain/repositories/vehicle.repository';

describe('ApproveBlockRequestUseCase', () => {
  let useCase: ApproveBlockRequestUseCase;

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

  const vehicleBlockRepoMock = {
    findActiveByVehicleIdAndCompanyId: jest.fn(),
    findActiveByPlateAndCompanyId: jest.fn(),
    create: jest.fn(),
  } as jest.Mocked<
    Pick<
      import('../../domain/repositories/vehicle-block.repository').VehicleBlockRepository,
      | 'findActiveByVehicleIdAndCompanyId'
      | 'findActiveByPlateAndCompanyId'
      | 'create'
    >
  >;

  const vehicleRepoMock = {
    findByPlateAndCompanyId: jest.fn(),
  } as jest.Mocked<
    Pick<
      import('../../../vehicles/domain/repositories/vehicle.repository').VehicleRepository,
      'findByPlateAndCompanyId'
    >
  >;

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

  const block: VehicleBlockEntity = {
    id: '50000000-0000-0000-0000-000000000001',
    companyId: admin.companyId,
    vehicleId: request.vehicleId,
    plate: request.plate,
    blockType: VehicleBlockType.MANUAL,
    reason: request.reason,
    status: VehicleBlockStatus.ACTIVE,
    blockedBy: admin.id,
    blockedAt: new Date('2026-08-24T12:00:00Z'),
    revokedBy: null,
    revokedAt: null,
    revokedReason: null,
    createdAt: new Date('2026-08-24T12:00:00Z'),
    updatedAt: new Date('2026-08-24T12:00:00Z'),
  };

  const approved: BlockRequestEntity = {
    ...request,
    status: BlockRequestStatus.APPROVED,
    handledBy: admin.id,
    handledAt: new Date('2026-08-24T12:00:00Z'),
    observation: 'Aprovado pela segurança',
    resolvedBlockId: block.id,
    statusHistory: [
      ...request.statusHistory,
      {
        status: BlockRequestStatus.APPROVED,
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
        ApproveBlockRequestUseCase,
        CreateVehicleBlockUseCase,
        { provide: BLOCK_REQUEST_REPOSITORY, useValue: blockRequestRepoMock },
        { provide: USER_REPOSITORY, useValue: userRepoMock },
        { provide: VEHICLE_BLOCK_REPOSITORY, useValue: vehicleBlockRepoMock },
        { provide: VEHICLE_REPOSITORY, useValue: vehicleRepoMock },
      ],
    }).compile();
    useCase = module.get(ApproveBlockRequestUseCase);
  });

  it('aprova criando o bloqueio MANUAL e ligando resolved_block_id', async () => {
    blockRequestRepoMock.findByIdAndCompanyId.mockResolvedValue(request);
    vehicleRepoMock.findByPlateAndCompanyId.mockResolvedValue(null);
    vehicleBlockRepoMock.findActiveByPlateAndCompanyId.mockResolvedValue(null);
    vehicleBlockRepoMock.create.mockResolvedValue(block);
    blockRequestRepoMock.updateStatusByIdAndCompanyId.mockResolvedValue(
      approved,
    );
    userRepoMock.findById.mockResolvedValue(doormanUser);

    const result = await useCase.execute(
      admin,
      new HandleBlockRequestInputDto(request.id, 'Aprovado pela segurança'),
    );

    // Bloqueio criado com o motivo da solicitação e blocked_by = admin.
    expect(vehicleBlockRepoMock.create).toHaveBeenCalledWith({
      companyId: admin.companyId,
      vehicleId: null,
      plate: request.plate,
      blockType: VehicleBlockType.MANUAL,
      reason: request.reason,
      blockedBy: admin.id,
    });
    expect(
      blockRequestRepoMock.updateStatusByIdAndCompanyId,
    ).toHaveBeenCalledWith(request.id, admin.companyId, {
      status: BlockRequestStatus.APPROVED,
      handledBy: admin.id,
      observation: 'Aprovado pela segurança',
      resolvedBlockId: block.id,
    });
    expect(result.status).toBe(BlockRequestStatus.APPROVED);
    expect(result.resolvedBlockId).toBe(block.id);
    expect(result.requestedBy).toEqual({
      id: doormanUser.id,
      name: doormanUser.name,
    });
    expect(result.handledBy).toEqual({ id: admin.id, name: admin.name });
  });

  it('lança 404 quando a solicitação não existe na empresa', async () => {
    blockRequestRepoMock.findByIdAndCompanyId.mockResolvedValue(null);

    await expect(
      useCase.execute(admin, new HandleBlockRequestInputDto(request.id)),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(vehicleBlockRepoMock.create).not.toHaveBeenCalled();
  });

  it('lança 409 quando a solicitação não está pendente', async () => {
    blockRequestRepoMock.findByIdAndCompanyId.mockResolvedValue(approved);

    await expect(
      useCase.execute(admin, new HandleBlockRequestInputDto(request.id)),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(vehicleBlockRepoMock.create).not.toHaveBeenCalled();
  });

  it('propaga 409 quando o veículo já está bloqueado (sem atualizar status)', async () => {
    blockRequestRepoMock.findByIdAndCompanyId.mockResolvedValue(request);
    vehicleRepoMock.findByPlateAndCompanyId.mockResolvedValue(null);
    vehicleBlockRepoMock.findActiveByPlateAndCompanyId.mockResolvedValue(block);

    await expect(
      useCase.execute(admin, new HandleBlockRequestInputDto(request.id)),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(
      blockRequestRepoMock.updateStatusByIdAndCompanyId,
    ).not.toHaveBeenCalled();
  });
});
