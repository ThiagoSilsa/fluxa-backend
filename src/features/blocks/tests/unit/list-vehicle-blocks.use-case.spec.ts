// NestJS
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
import type { UserEntity } from '../../../users/domain/entities/user.entity';
import type { VehicleBlockRepository } from '../../domain/repositories/vehicle-block.repository';
import type { UserRepository } from '../../../users/domain/repositories/user.repository';

// Repositories
import { VEHICLE_BLOCK_REPOSITORY } from '../../domain/repositories/vehicle-block.repository';
import { USER_REPOSITORY } from '../../../users/domain/repositories/user.repository';

// DTOs
import { ListBlocksInputDto } from '../../application/dto/list-blocks-input.dto';

// Use case
import { ListVehicleBlocksUseCase } from '../../application/use-cases/list-vehicle-blocks.use-case';

describe('ListVehicleBlocksUseCase', () => {
  let useCase: ListVehicleBlocksUseCase;

  const vehicleBlockRepoMock = {
    list: jest.fn(),
  } as jest.Mocked<Pick<VehicleBlockRepository, 'list'>>;

  const userRepoMock = {
    findById: jest.fn(),
  } as jest.Mocked<Pick<UserRepository, 'findById'>>;

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

  const adminUser: UserEntity = {
    id: actor.id,
    name: actor.name,
    email: actor.email,
    passwordHash: 'hash',
    phone: null,
    document: null,
    photoUrl: null,
    lastLoginAt: null,
    createdAt: new Date('2026-08-21T00:00:00Z'),
    updatedAt: new Date('2026-08-21T00:00:00Z'),
  };

  const activeBlock: VehicleBlockEntity = {
    id: '50000000-0000-0000-0000-000000000001',
    companyId: actor.companyId,
    vehicleId: '40000000-0000-0000-0000-000000000010',
    plate: 'ABC1D23',
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

  const revokedBlock: VehicleBlockEntity = {
    ...activeBlock,
    id: '50000000-0000-0000-0000-000000000002',
    plate: 'XYZ9A99',
    status: VehicleBlockStatus.REVOKED,
    revokedBy: actor.id,
    revokedAt: new Date('2026-08-23T00:00:00Z'),
    revokedReason: 'Engano',
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module = await Test.createTestingModule({
      providers: [
        ListVehicleBlocksUseCase,
        { provide: VEHICLE_BLOCK_REPOSITORY, useValue: vehicleBlockRepoMock },
        { provide: USER_REPOSITORY, useValue: userRepoMock },
      ],
    }).compile();
    useCase = module.get(ListVehicleBlocksUseCase);
  });

  it('lista bloqueios no formato padrão resolvendo atores em lote', async () => {
    vehicleBlockRepoMock.list.mockResolvedValue({
      data: [activeBlock, revokedBlock],
      count: 2,
    });
    userRepoMock.findById.mockResolvedValue(adminUser);

    const result = await useCase.execute(
      actor,
      new ListBlocksInputDto('ABC', VehicleBlockStatus.ACTIVE, 10, 0),
    );

    expect(vehicleBlockRepoMock.list).toHaveBeenCalledWith(actor.companyId, {
      search: 'ABC',
      status: VehicleBlockStatus.ACTIVE,
      limit: 10,
      offset: 0,
    });
    // 3 ids distintos: blocked_by do ativo + blocked_by/revoked_by do revogado.
    expect(userRepoMock.findById).toHaveBeenCalledTimes(1);
    expect(result.limit).toBe(10);
    expect(result.offset).toBe(0);
    expect(result.count).toBe(2);
    expect(result.data).toHaveLength(2);
    expect(result.data[0].blockedBy).toEqual({
      id: actor.id,
      name: actor.name,
    });
    expect(result.data[1].revokedBy).toEqual({
      id: actor.id,
      name: actor.name,
    });
  });

  it('ignora atores não resolvidos (null)', async () => {
    vehicleBlockRepoMock.list.mockResolvedValue({
      data: [activeBlock],
      count: 1,
    });
    userRepoMock.findById.mockResolvedValue(null);

    const result = await useCase.execute(
      actor,
      new ListBlocksInputDto(undefined, undefined, 20, 0),
    );

    expect(result.data[0].blockedBy).toBeNull();
  });

  it('retorna página vazia quando não há bloqueios', async () => {
    vehicleBlockRepoMock.list.mockResolvedValue({ data: [], count: 0 });

    const result = await useCase.execute(
      actor,
      new ListBlocksInputDto(undefined, undefined, 20, 0),
    );

    expect(result.data).toEqual([]);
    expect(result.count).toBe(0);
  });
});
