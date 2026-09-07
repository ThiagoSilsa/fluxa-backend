// NestJS
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';

// Shared
import { PermissionCode } from '../../../../shared/constants/access-control.constant';

// Constants
import { UserType } from '../../../auth/domain/constants/user-type.constant';
import {
  EntryDenialReason,
  SyncStatus,
} from '../../domain/constants/block.constant';

// Types
import type { AuthenticatedUserEntity } from '../../../auth/domain/entities/authenticated-user.entity';
import type { EntryDenialEntity } from '../../domain/entities/entry-denial.entity';
import type { VehicleBlockEntity } from '../../domain/entities/vehicle-block.entity';
import type { VehicleWithTypeEntity } from '../../../vehicles/domain/entities/vehicle.entity';
import type { EntryDenialRepository } from '../../domain/repositories/entry-denial.repository';
import type { VehicleBlockRepository } from '../../domain/repositories/vehicle-block.repository';
import type { VehicleRepository } from '../../../vehicles/domain/repositories/vehicle.repository';

// Repositories
import { ENTRY_DENIAL_REPOSITORY } from '../../domain/repositories/entry-denial.repository';
import { VEHICLE_BLOCK_REPOSITORY } from '../../domain/repositories/vehicle-block.repository';
import { VEHICLE_REPOSITORY } from '../../../vehicles/domain/repositories/vehicle.repository';

// Constants
import {
  VehicleBlockStatus,
  VehicleBlockType,
} from '../../domain/constants/block.constant';

// DTOs
import { RegisterEntryDenialInputDto } from '../../application/dto/register-entry-denial-input.dto';

// Use case
import { RegisterEntryDenialUseCase } from '../../application/use-cases/register-entry-denial.use-case';

describe('RegisterEntryDenialUseCase', () => {
  let useCase: RegisterEntryDenialUseCase;

  const entryDenialRepoMock = {
    create: jest.fn(),
  } as jest.Mocked<Pick<EntryDenialRepository, 'create'>>;

  const vehicleBlockRepoMock = {
    findByIdAndCompanyId: jest.fn(),
  } as jest.Mocked<Pick<VehicleBlockRepository, 'findByIdAndCompanyId'>>;

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
    permissions: [PermissionCode.REGISTER_DENIAL],
  };

  const vehicle: VehicleWithTypeEntity = {
    id: '40000000-0000-0000-0000-000000000010',
    plate: 'ABC1D23',
    companyId: actor.companyId,
    model: null,
    color: null,
    observation: null,
    isBlocked: true,
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
    blockedBy: '30000000-0000-0000-0000-000000000001',
    blockedAt: new Date('2026-08-22T00:00:00Z'),
    revokedBy: null,
    revokedAt: null,
    revokedReason: null,
    createdAt: new Date('2026-08-22T00:00:00Z'),
    updatedAt: new Date('2026-08-22T00:00:00Z'),
  };

  const denial: EntryDenialEntity = {
    id: '50000000-0000-0000-0000-000000000010',
    companyId: actor.companyId,
    vehicleId: vehicle.id,
    plateSnapshot: vehicle.plate,
    blockId: block.id,
    reason: EntryDenialReason.BLOCKED,
    observation: 'Veículo em ocorrência',
    entranceId: null,
    doormanId: actor.id,
    occurredAt: new Date('2026-08-24T10:00:00Z'),
    syncStatus: SyncStatus.SYNCED,
    idempotencyKey: 'abc-123',
    createdAt: new Date('2026-08-24T10:00:00Z'),
    updatedAt: new Date('2026-08-24T10:00:00Z'),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module = await Test.createTestingModule({
      providers: [
        RegisterEntryDenialUseCase,
        { provide: ENTRY_DENIAL_REPOSITORY, useValue: entryDenialRepoMock },
        { provide: VEHICLE_BLOCK_REPOSITORY, useValue: vehicleBlockRepoMock },
        { provide: VEHICLE_REPOSITORY, useValue: vehicleRepoMock },
      ],
    }).compile();
    useCase = module.get(RegisterEntryDenialUseCase);
  });

  it('registra impedimento resolvendo veículo por placa e validando o bloqueio', async () => {
    vehicleBlockRepoMock.findByIdAndCompanyId.mockResolvedValue(block);
    vehicleRepoMock.findByPlateAndCompanyId.mockResolvedValue(vehicle);
    entryDenialRepoMock.create.mockImplementation((data) =>
      Promise.resolve({
        ...denial,
        idempotencyKey: data.idempotencyKey,
      }),
    );

    const result = await useCase.execute(
      actor,
      new RegisterEntryDenialInputDto(
        'ABC1D23',
        EntryDenialReason.BLOCKED,
        'Veículo em ocorrência',
        block.id,
      ),
    );

    expect(vehicleBlockRepoMock.findByIdAndCompanyId).toHaveBeenCalledWith(
      block.id,
      actor.companyId,
    );
    expect(vehicleRepoMock.findByPlateAndCompanyId).toHaveBeenCalledWith(
      'ABC1D23',
      actor.companyId,
    );
    expect(entryDenialRepoMock.create).toHaveBeenCalledWith(
      expect.objectContaining({
        companyId: actor.companyId,
        vehicleId: vehicle.id,
        plateSnapshot: 'ABC1D23',
        blockId: block.id,
        reason: EntryDenialReason.BLOCKED,
        observation: 'Veículo em ocorrência',
        entranceId: null,
        doormanId: actor.id,
        syncStatus: SyncStatus.SYNCED,
      }),
    );
    // idempotency_key gerada no servidor.
    const call = entryDenialRepoMock.create.mock.calls[0][0];
    expect(call.idempotencyKey).toEqual(expect.any(String));
    expect(result.reason).toBe(EntryDenialReason.BLOCKED);
    expect(result.blockId).toBe(block.id);
  });

  it('registra impedimento sem veículo cadastrado (plateSnapshot, vehicleId null)', async () => {
    vehicleBlockRepoMock.findByIdAndCompanyId.mockResolvedValue(null);
    vehicleRepoMock.findByPlateAndCompanyId.mockResolvedValue(null);
    const unregistered: EntryDenialEntity = {
      ...denial,
      vehicleId: null,
      plateSnapshot: 'XYZ9A99',
      blockId: null,
      reason: EntryDenialReason.UNREGISTERED,
    };
    entryDenialRepoMock.create.mockResolvedValue(unregistered);

    const result = await useCase.execute(
      actor,
      new RegisterEntryDenialInputDto(
        'XYZ9A99',
        EntryDenialReason.UNREGISTERED,
      ),
    );

    expect(result.vehicleId).toBeNull();
    expect(result.plateSnapshot).toBe('XYZ9A99');
  });

  it('lança 404 quando o bloqueio informado não existe na empresa', async () => {
    vehicleBlockRepoMock.findByIdAndCompanyId.mockResolvedValue(null);

    await expect(
      useCase.execute(
        actor,
        new RegisterEntryDenialInputDto(
          'ABC1D23',
          EntryDenialReason.BLOCKED,
          undefined,
          block.id,
        ),
      ),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(entryDenialRepoMock.create).not.toHaveBeenCalled();
  });

  it('lança 400 para placa vazia', async () => {
    await expect(
      useCase.execute(
        actor,
        new RegisterEntryDenialInputDto('', EntryDenialReason.OTHER),
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(entryDenialRepoMock.create).not.toHaveBeenCalled();
  });
});
