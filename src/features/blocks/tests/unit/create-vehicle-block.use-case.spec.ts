// NestJS
import { BadRequestException, ConflictException } from '@nestjs/common';
import { Test } from '@nestjs/testing';

// Shared
import { PermissionCode } from '../../../../shared/constants/access-control.constant';

// Constants
import { UserType } from '../../../auth/domain/constants/user-type.constant';
import {
  VehicleBlockStatus,
  VehicleBlockType,
} from '../../domain/constants/block.constant';

// Types
import type { AuthenticatedUserEntity } from '../../../auth/domain/entities/authenticated-user.entity';
import type { VehicleBlockEntity } from '../../domain/entities/vehicle-block.entity';
import type { VehicleWithTypeEntity } from '../../../vehicles/domain/entities/vehicle.entity';
import type { VehicleBlockRepository } from '../../domain/repositories/vehicle-block.repository';
import type { VehicleRepository } from '../../../vehicles/domain/repositories/vehicle.repository';

// Repositories
import { VEHICLE_BLOCK_REPOSITORY } from '../../domain/repositories/vehicle-block.repository';
import { VEHICLE_REPOSITORY } from '../../../vehicles/domain/repositories/vehicle.repository';

// DTOs
import { CreateBlockInputDto } from '../../application/dto/create-block-input.dto';

// Use case
import { CreateVehicleBlockUseCase } from '../../application/use-cases/create-vehicle-block.use-case';

describe('CreateVehicleBlockUseCase', () => {
  let useCase: CreateVehicleBlockUseCase;

  const vehicleBlockRepoMock = {
    findActiveByVehicleIdAndCompanyId: jest.fn(),
    findActiveByPlateAndCompanyId: jest.fn(),
    create: jest.fn(),
  } as jest.Mocked<
    Pick<
      VehicleBlockRepository,
      | 'findActiveByVehicleIdAndCompanyId'
      | 'findActiveByPlateAndCompanyId'
      | 'create'
    >
  >;

  const vehicleRepoMock = {
    findByPlateAndCompanyId: jest.fn(),
  } as jest.Mocked<Pick<VehicleRepository, 'findByPlateAndCompanyId'>>;

  const actor: AuthenticatedUserEntity = {
    id: '30000000-0000-0000-0000-000000000001',
    companyId: '10000000-0000-0000-0000-000000000001',
    email: 'admin@somar.local',
    name: 'Administrador',
    type: UserType.EMPLOYEE,
    isAdmin: true,
    roleCodes: ['Administração'],
    permissions: [PermissionCode.MANAGE_BLOCKS],
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

  const block: VehicleBlockEntity = {
    id: '50000000-0000-0000-0000-000000000001',
    companyId: actor.companyId,
    vehicleId: vehicle.id,
    plate: vehicle.plate,
    blockType: VehicleBlockType.MANUAL,
    reason: 'Furto suspeito',
    status: VehicleBlockStatus.ACTIVE,
    blockedBy: actor.id,
    blockedAt: new Date('2026-08-22T00:00:00Z'),
    revokedBy: null,
    revokedAt: null,
    revokedReason: null,
    createdAt: new Date('2026-08-22T00:00:00Z'),
    updatedAt: new Date('2026-08-22T00:00:00Z'),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module = await Test.createTestingModule({
      providers: [
        CreateVehicleBlockUseCase,
        { provide: VEHICLE_BLOCK_REPOSITORY, useValue: vehicleBlockRepoMock },
        { provide: VEHICLE_REPOSITORY, useValue: vehicleRepoMock },
      ],
    }).compile();
    useCase = module.get(CreateVehicleBlockUseCase);
  });

  it('bloqueia veículo cadastrado e mantém is_blocked na mesma transação', async () => {
    vehicleRepoMock.findByPlateAndCompanyId.mockResolvedValue(vehicle);
    vehicleBlockRepoMock.findActiveByVehicleIdAndCompanyId.mockResolvedValue(
      null,
    );
    vehicleBlockRepoMock.create.mockResolvedValue(block);

    const result = await useCase.execute(
      actor,
      new CreateBlockInputDto('abc-1d23', 'Furto suspeito'),
    );

    expect(vehicleRepoMock.findByPlateAndCompanyId).toHaveBeenCalledWith(
      'ABC1D23',
      actor.companyId,
    );
    expect(
      vehicleBlockRepoMock.findActiveByVehicleIdAndCompanyId,
    ).toHaveBeenCalledWith(vehicle.id, actor.companyId);
    expect(vehicleBlockRepoMock.create).toHaveBeenCalledWith({
      companyId: actor.companyId,
      vehicleId: vehicle.id,
      plate: 'ABC1D23',
      blockType: VehicleBlockType.MANUAL,
      reason: 'Furto suspeito',
      blockedBy: actor.id,
    });
    expect(result).toEqual({
      id: block.id,
      plate: block.plate,
      vehicleId: block.vehicleId,
      blockType: block.blockType,
      reason: block.reason,
      status: block.status,
      blockedBy: { id: actor.id, name: actor.name },
      blockedAt: block.blockedAt.toISOString(),
      revokedBy: null,
      revokedAt: null,
      revokedReason: null,
      createdAt: block.createdAt.toISOString(),
    });
  });

  it('bloqueia placa de veículo NÃO cadastrado (vehicleId null, vínculo por placa)', async () => {
    vehicleRepoMock.findByPlateAndCompanyId.mockResolvedValue(null);
    vehicleBlockRepoMock.findActiveByPlateAndCompanyId.mockResolvedValue(null);
    const unregistered = {
      ...block,
      id: '50000000-0000-0000-0000-000000000002',
      vehicleId: null,
    };
    vehicleBlockRepoMock.create.mockResolvedValue(unregistered);

    const result = await useCase.execute(
      actor,
      new CreateBlockInputDto('XYZ9A99', 'Acesso negado'),
    );

    expect(
      vehicleBlockRepoMock.findActiveByPlateAndCompanyId,
    ).toHaveBeenCalledWith('XYZ9A99', actor.companyId);
    expect(vehicleBlockRepoMock.create).toHaveBeenCalledWith({
      companyId: actor.companyId,
      vehicleId: null,
      plate: 'XYZ9A99',
      blockType: VehicleBlockType.MANUAL,
      reason: 'Acesso negado',
      blockedBy: actor.id,
    });
    expect(result.vehicleId).toBeNull();
  });

  it('lança 409 se já existe bloqueio ativo do veículo cadastrado', async () => {
    vehicleRepoMock.findByPlateAndCompanyId.mockResolvedValue(vehicle);
    vehicleBlockRepoMock.findActiveByVehicleIdAndCompanyId.mockResolvedValue(
      block,
    );

    await expect(
      useCase.execute(actor, new CreateBlockInputDto('ABC1D23', 'Motivo')),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(vehicleBlockRepoMock.create).not.toHaveBeenCalled();
  });

  it('lança 409 se já existe bloqueio ativo da placa (veículo não cadastrado)', async () => {
    vehicleRepoMock.findByPlateAndCompanyId.mockResolvedValue(null);
    vehicleBlockRepoMock.findActiveByPlateAndCompanyId.mockResolvedValue(block);

    await expect(
      useCase.execute(actor, new CreateBlockInputDto('XYZ9A99', 'Motivo')),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('lança 400 para placa vazia', async () => {
    await expect(
      useCase.execute(actor, new CreateBlockInputDto('', 'Motivo')),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(vehicleBlockRepoMock.create).not.toHaveBeenCalled();
  });

  it('lança 400 para motivo vazio', async () => {
    await expect(
      useCase.execute(actor, new CreateBlockInputDto('ABC1D23', '   ')),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(vehicleBlockRepoMock.create).not.toHaveBeenCalled();
  });
});
