// NestJS
import { BadRequestException, ConflictException } from '@nestjs/common';
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
import type { VehicleWithTypeEntity } from '../../../vehicles/domain/entities/vehicle.entity';
import type { BlockRequestRepository } from '../../domain/repositories/block-request.repository';
import type { VehicleRepository } from '../../../vehicles/domain/repositories/vehicle.repository';

// Repositories
import { BLOCK_REQUEST_REPOSITORY } from '../../domain/repositories/block-request.repository';
import { VEHICLE_REPOSITORY } from '../../../vehicles/domain/repositories/vehicle.repository';

// DTOs
import { CreateBlockRequestInputDto } from '../../application/dto/create-block-request-input.dto';

// Use case
import { CreateBlockRequestUseCase } from '../../application/use-cases/create-block-request.use-case';

describe('CreateBlockRequestUseCase', () => {
  let useCase: CreateBlockRequestUseCase;

  const blockRequestRepoMock = {
    findPendingByPlateAndCompanyId: jest.fn(),
    create: jest.fn(),
  } as jest.Mocked<
    Pick<BlockRequestRepository, 'findPendingByPlateAndCompanyId' | 'create'>
  >;

  const vehicleRepoMock = {
    findByPlateAndCompanyId: jest.fn(),
  } as jest.Mocked<Pick<VehicleRepository, 'findByPlateAndCompanyId'>>;

  const actor: AuthenticatedUserEntity = {
    id: '30000000-0000-0000-0000-000000000002',
    companyId: '10000000-0000-0000-0000-000000000001',
    email: 'porteiro@somar.local',
    name: 'Porteiro Silva',
    type: UserType.EMPLOYEE,
    isAdmin: false,
    roleCodes: ['Portaria'],
    permissions: [PermissionCode.CREATE_BLOCK_REQUEST],
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

  const request: BlockRequestEntity = {
    id: '50000000-0000-0000-0000-000000000020',
    companyId: actor.companyId,
    vehicleId: vehicle.id,
    plate: vehicle.plate,
    reason: 'Veículo com condutor suspeito',
    status: BlockRequestStatus.PENDING,
    requestedBy: actor.id,
    requestedAt: new Date('2026-08-24T11:00:00Z'),
    handledBy: null,
    handledAt: null,
    observation: null,
    statusHistory: [
      {
        status: BlockRequestStatus.PENDING,
        at: '2026-08-24T11:00:00Z',
        by: actor.id,
      },
    ],
    resolvedBlockId: null,
    syncStatus: SyncStatus.SYNCED,
    idempotencyKey: 'req-123',
    createdAt: new Date('2026-08-24T11:00:00Z'),
    updatedAt: new Date('2026-08-24T11:00:00Z'),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module = await Test.createTestingModule({
      providers: [
        CreateBlockRequestUseCase,
        { provide: BLOCK_REQUEST_REPOSITORY, useValue: blockRequestRepoMock },
        { provide: VEHICLE_REPOSITORY, useValue: vehicleRepoMock },
      ],
    }).compile();
    useCase = module.get(CreateBlockRequestUseCase);
  });

  it('cria solicitação PENDING resolvendo veículo por placa', async () => {
    blockRequestRepoMock.findPendingByPlateAndCompanyId.mockResolvedValue(null);
    vehicleRepoMock.findByPlateAndCompanyId.mockResolvedValue(vehicle);
    blockRequestRepoMock.create.mockImplementation((data) =>
      Promise.resolve({
        ...request,
        idempotencyKey: data.idempotencyKey,
      }),
    );

    const result = await useCase.execute(
      actor,
      new CreateBlockRequestInputDto(
        'ABC1D23',
        'Veículo com condutor suspeito',
      ),
    );

    expect(blockRequestRepoMock.create).toHaveBeenCalledWith(
      expect.objectContaining({
        companyId: actor.companyId,
        vehicleId: vehicle.id,
        plate: 'ABC1D23',
        reason: 'Veículo com condutor suspeito',
        requestedBy: actor.id,
        syncStatus: SyncStatus.SYNCED,
      }),
    );
    expect(result.status).toBe(BlockRequestStatus.PENDING);
    expect(result.requestedBy).toEqual({ id: actor.id, name: actor.name });
  });

  it('cria solicitação de placa não cadastrada (vehicleId null)', async () => {
    blockRequestRepoMock.findPendingByPlateAndCompanyId.mockResolvedValue(null);
    vehicleRepoMock.findByPlateAndCompanyId.mockResolvedValue(null);
    blockRequestRepoMock.create.mockResolvedValue({
      ...request,
      vehicleId: null,
      plate: 'XYZ9A99',
    });

    const result = await useCase.execute(
      actor,
      new CreateBlockRequestInputDto('XYZ9A99', 'Placa suspeita'),
    );

    expect(result.vehicleId).toBeNull();
    expect(result.plate).toBe('XYZ9A99');
  });

  it('lança 409 quando já existe solicitação pendente da placa', async () => {
    blockRequestRepoMock.findPendingByPlateAndCompanyId.mockResolvedValue(
      request,
    );

    await expect(
      useCase.execute(
        actor,
        new CreateBlockRequestInputDto('ABC1D23', 'Outro motivo'),
      ),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(blockRequestRepoMock.create).not.toHaveBeenCalled();
  });

  it('lança 400 para placa vazia', async () => {
    await expect(
      useCase.execute(actor, new CreateBlockRequestInputDto('', 'Motivo')),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(blockRequestRepoMock.create).not.toHaveBeenCalled();
  });

  it('lança 400 para motivo vazio', async () => {
    await expect(
      useCase.execute(actor, new CreateBlockRequestInputDto('ABC1D23', '  ')),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(blockRequestRepoMock.create).not.toHaveBeenCalled();
  });
});
