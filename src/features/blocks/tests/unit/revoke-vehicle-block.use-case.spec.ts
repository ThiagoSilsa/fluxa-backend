// NestJS
import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
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
import { RevokeBlockInputDto } from '../../application/dto/revoke-block-input.dto';

// Use case
import { RevokeVehicleBlockUseCase } from '../../application/use-cases/revoke-vehicle-block.use-case';

describe('RevokeVehicleBlockUseCase', () => {
  let useCase: RevokeVehicleBlockUseCase;

  const vehicleBlockRepoMock = {
    findByIdAndCompanyId: jest.fn(),
    revokeByIdAndCompanyId: jest.fn(),
  } as jest.Mocked<
    Pick<
      VehicleBlockRepository,
      'findByIdAndCompanyId' | 'revokeByIdAndCompanyId'
    >
  >;

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

  const block: VehicleBlockEntity = {
    id: '50000000-0000-0000-0000-000000000001',
    companyId: actor.companyId,
    vehicleId: '40000000-0000-0000-0000-000000000010',
    plate: 'ABC1D23',
    blockType: VehicleBlockType.MANUAL,
    reason: 'Furto suspeito',
    status: VehicleBlockStatus.ACTIVE,
    blockedBy: doormanUser.id,
    blockedAt: new Date('2026-08-22T00:00:00Z'),
    revokedBy: null,
    revokedAt: null,
    revokedReason: null,
    createdAt: new Date('2026-08-22T00:00:00Z'),
    updatedAt: new Date('2026-08-22T00:00:00Z'),
  };

  const revoked: VehicleBlockEntity = {
    ...block,
    status: VehicleBlockStatus.REVOKED,
    revokedBy: actor.id,
    revokedAt: new Date('2026-08-23T00:00:00Z'),
    revokedReason: 'Engano do porteiro',
    updatedAt: new Date('2026-08-23T00:00:00Z'),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module = await Test.createTestingModule({
      providers: [
        RevokeVehicleBlockUseCase,
        { provide: VEHICLE_BLOCK_REPOSITORY, useValue: vehicleBlockRepoMock },
        { provide: USER_REPOSITORY, useValue: userRepoMock },
      ],
    }).compile();
    useCase = module.get(RevokeVehicleBlockUseCase);
  });

  it('revoga bloqueio ativo e preenche revoked_by/revoked_reason', async () => {
    vehicleBlockRepoMock.findByIdAndCompanyId.mockResolvedValue(block);
    vehicleBlockRepoMock.revokeByIdAndCompanyId.mockResolvedValue(revoked);
    userRepoMock.findById.mockResolvedValue(doormanUser);

    const result = await useCase.execute(
      actor,
      new RevokeBlockInputDto(block.id, 'Engano do porteiro'),
    );

    expect(vehicleBlockRepoMock.revokeByIdAndCompanyId).toHaveBeenCalledWith(
      block.id,
      actor.companyId,
      { revokedBy: actor.id, revokedReason: 'Engano do porteiro' },
    );
    expect(result.status).toBe(VehicleBlockStatus.REVOKED);
    expect(result.revokedBy).toEqual({ id: actor.id, name: actor.name });
    expect(result.blockedBy).toEqual({
      id: doormanUser.id,
      name: doormanUser.name,
    });
  });

  it('lança 404 quando o bloqueio não existe na empresa', async () => {
    vehicleBlockRepoMock.findByIdAndCompanyId.mockResolvedValue(null);

    await expect(
      useCase.execute(actor, new RevokeBlockInputDto(block.id, 'Motivo')),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(vehicleBlockRepoMock.revokeByIdAndCompanyId).not.toHaveBeenCalled();
  });

  it('lança 409 quando o bloqueio não está ativo', async () => {
    vehicleBlockRepoMock.findByIdAndCompanyId.mockResolvedValue(revoked);

    await expect(
      useCase.execute(actor, new RevokeBlockInputDto(block.id, 'Motivo')),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(vehicleBlockRepoMock.revokeByIdAndCompanyId).not.toHaveBeenCalled();
  });

  it('lança 400 para motivo de revogação vazio', async () => {
    await expect(
      useCase.execute(actor, new RevokeBlockInputDto(block.id, '   ')),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(vehicleBlockRepoMock.findByIdAndCompanyId).not.toHaveBeenCalled();
  });
});
