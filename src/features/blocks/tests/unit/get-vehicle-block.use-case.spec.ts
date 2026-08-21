// NestJS
import { NotFoundException } from '@nestjs/common';
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
import { GetBlockInputDto } from '../../application/dto/list-blocks-input.dto';

// Use case
import { GetVehicleBlockUseCase } from '../../application/use-cases/get-vehicle-block.use-case';

describe('GetVehicleBlockUseCase', () => {
  let useCase: GetVehicleBlockUseCase;

  const vehicleBlockRepoMock = {
    findByIdAndCompanyId: jest.fn(),
  } as jest.Mocked<Pick<VehicleBlockRepository, 'findByIdAndCompanyId'>>;

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

  const block: VehicleBlockEntity = {
    id: '50000000-0000-0000-0000-000000000001',
    companyId: actor.companyId,
    vehicleId: null,
    plate: 'XYZ9A99',
    blockType: VehicleBlockType.MANUAL,
    reason: 'Acesso negado',
    status: VehicleBlockStatus.REVOKED,
    blockedBy: actor.id,
    blockedAt: new Date('2026-08-22T00:00:00Z'),
    revokedBy: actor.id,
    revokedAt: new Date('2026-08-23T00:00:00Z'),
    revokedReason: 'Engano',
    createdAt: new Date('2026-08-22T00:00:00Z'),
    updatedAt: new Date('2026-08-23T00:00:00Z'),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module = await Test.createTestingModule({
      providers: [
        GetVehicleBlockUseCase,
        { provide: VEHICLE_BLOCK_REPOSITORY, useValue: vehicleBlockRepoMock },
        { provide: USER_REPOSITORY, useValue: userRepoMock },
      ],
    }).compile();
    useCase = module.get(GetVehicleBlockUseCase);
  });

  it('detalha bloqueio resolvendo blocked_by e revoked_by', async () => {
    vehicleBlockRepoMock.findByIdAndCompanyId.mockResolvedValue(block);
    userRepoMock.findById.mockResolvedValue(adminUser);

    const result = await useCase.execute(actor, new GetBlockInputDto(block.id));

    expect(vehicleBlockRepoMock.findByIdAndCompanyId).toHaveBeenCalledWith(
      block.id,
      actor.companyId,
    );
    expect(result.blockedBy).toEqual({ id: actor.id, name: actor.name });
    expect(result.revokedBy).toEqual({ id: actor.id, name: actor.name });
    expect(result.revokedReason).toBe('Engano');
  });

  it('lança 404 quando o bloqueio não existe na empresa (cross-tenant oculto)', async () => {
    vehicleBlockRepoMock.findByIdAndCompanyId.mockResolvedValue(null);

    await expect(
      useCase.execute(actor, new GetBlockInputDto(block.id)),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(userRepoMock.findById).not.toHaveBeenCalled();
  });
});
