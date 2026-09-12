// NestJS
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
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
import type { EntranceEntity } from '../../../entrances/domain/entities/entrance.entity';
import type { EntryDenialRepository } from '../../domain/repositories/entry-denial.repository';
import type { VehicleBlockRepository } from '../../domain/repositories/vehicle-block.repository';
import type { VehicleRepository } from '../../../vehicles/domain/repositories/vehicle.repository';
import type { EntranceRepository } from '../../../entrances/domain/repositories/entrance.repository';

// Repositories
import { ENTRY_DENIAL_REPOSITORY } from '../../domain/repositories/entry-denial.repository';
import { VEHICLE_BLOCK_REPOSITORY } from '../../domain/repositories/vehicle-block.repository';
import { VEHICLE_REPOSITORY } from '../../../vehicles/domain/repositories/vehicle.repository';
import { ENTRANCE_REPOSITORY } from '../../../entrances/domain/repositories/entrance.repository';

// Constants
import {
  VehicleBlockStatus,
  VehicleBlockType,
} from '../../domain/constants/block.constant';

// DTOs
import { RegisterEntryDenialInputDto } from '../../application/dto/register-entry-denial-input.dto';

// Use case
import { RegisterEntryDenialUseCase } from '../../application/use-cases/register-entry-denial.use-case';
import { CreateBlockRequestUseCase } from '../../application/use-cases/create-block-request.use-case';

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

  const entranceRepoMock = {
    findByIdAndCompanyId: jest.fn(),
  } as jest.Mocked<Pick<EntranceRepository, 'findByIdAndCompanyId'>>;

  const createBlockRequestUseCaseMock: { execute: jest.Mock } = {
    execute: jest.fn(),
  };

  const actor: AuthenticatedUserEntity = {
    id: '30000000-0000-0000-0000-000000000002',
    companyId: '10000000-0000-0000-0000-000000000001',
    email: 'porteiro@somar.local',
    name: 'Porteiro Silva',
    type: UserType.EMPLOYEE,
    isAdmin: false,
    roleCodes: ['Portaria'],
    permissions: [
      PermissionCode.REGISTER_DENIAL,
      PermissionCode.CREATE_BLOCK_REQUEST,
    ],
  };

  const entrance: EntranceEntity = {
    id: '60000000-0000-0000-0000-000000000001',
    companyId: actor.companyId,
    name: 'Portaria Principal',
    isActive: true,
    createdAt: new Date('2026-08-01T00:00:00Z'),
    updatedAt: new Date('2026-08-01T00:00:00Z'),
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
        { provide: ENTRANCE_REPOSITORY, useValue: entranceRepoMock },
        {
          provide: CreateBlockRequestUseCase,
          useValue: createBlockRequestUseCaseMock,
        },
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

  it('exige observação quando o motivo é OTHER', async () => {
    await expect(
      useCase.execute(
        actor,
        new RegisterEntryDenialInputDto('ABC1D23', EntryDenialReason.OTHER),
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(entryDenialRepoMock.create).not.toHaveBeenCalled();
  });

  it('aceita OTHER com observação', async () => {
    vehicleRepoMock.findByPlateAndCompanyId.mockResolvedValue(vehicle);
    entryDenialRepoMock.create.mockResolvedValue({
      ...denial,
      reason: EntryDenialReason.OTHER,
    });

    const result = await useCase.execute(
      actor,
      new RegisterEntryDenialInputDto(
        'ABC1D23',
        EntryDenialReason.OTHER,
        '  Sem autorização do setor  ',
      ),
    );

    expect(entryDenialRepoMock.create).toHaveBeenCalledWith(
      expect.objectContaining({ observation: 'Sem autorização do setor' }),
    );
    expect(result.blockRequest).toBeNull();
    expect(result.blockRequestError).toBeNull();
  });

  it('grava a portaria do device validada (M4)', async () => {
    vehicleRepoMock.findByPlateAndCompanyId.mockResolvedValue(vehicle);
    entranceRepoMock.findByIdAndCompanyId.mockResolvedValue(entrance);
    entryDenialRepoMock.create.mockImplementation((data) =>
      Promise.resolve({ ...denial, entranceId: data.entranceId }),
    );

    const result = await useCase.execute(
      actor,
      new RegisterEntryDenialInputDto(
        'ABC1D23',
        EntryDenialReason.UNREGISTERED,
        undefined,
        undefined,
        undefined,
        entrance.id,
      ),
    );

    expect(entryDenialRepoMock.create).toHaveBeenCalledWith(
      expect.objectContaining({ entranceId: entrance.id }),
    );
    expect(result.id).toBe(denial.id);
  });

  it('lança 404 para portaria inexistente e 400 para inativa', async () => {
    entranceRepoMock.findByIdAndCompanyId.mockResolvedValue(null);
    await expect(
      useCase.execute(
        actor,
        new RegisterEntryDenialInputDto(
          'ABC1D23',
          EntryDenialReason.UNREGISTERED,
          undefined,
          undefined,
          undefined,
          '60000000-0000-0000-0000-000000000099',
        ),
      ),
    ).rejects.toBeInstanceOf(NotFoundException);

    entranceRepoMock.findByIdAndCompanyId.mockResolvedValue({
      ...entrance,
      isActive: false,
    });
    await expect(
      useCase.execute(
        actor,
        new RegisterEntryDenialInputDto(
          'ABC1D23',
          EntryDenialReason.UNREGISTERED,
          undefined,
          undefined,
          undefined,
          entrance.id,
        ),
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(entryDenialRepoMock.create).not.toHaveBeenCalled();
  });

  it('cria o pedido de bloqueio junto com o impedimento (desmarcado por padrão)', async () => {
    vehicleBlockRepoMock.findByIdAndCompanyId.mockResolvedValue(block);
    vehicleRepoMock.findByPlateAndCompanyId.mockResolvedValue(vehicle);
    entryDenialRepoMock.create.mockResolvedValue(denial);
    createBlockRequestUseCaseMock.execute.mockResolvedValue({
      id: '70000000-0000-0000-0000-000000000001',
      plate: 'ABC1D23',
      status: 'PENDING',
    });

    const result = await useCase.execute(
      actor,
      new RegisterEntryDenialInputDto(
        'ABC1D23',
        EntryDenialReason.BLOCKED,
        'Veículo em ocorrência',
        block.id,
        undefined,
        undefined,
        true,
      ),
    );

    expect(createBlockRequestUseCaseMock.execute).toHaveBeenCalledWith(
      actor,
      expect.objectContaining({
        plate: 'ABC1D23',
        reason: 'Veículo em ocorrência',
      }),
    );
    expect(result.blockRequest).toEqual({
      id: '70000000-0000-0000-0000-000000000001',
      plate: 'ABC1D23',
      status: 'PENDING',
    });
    expect(result.blockRequestError).toBeNull();
  });

  it('não cria o pedido de bloqueio quando não foi pedido', async () => {
    vehicleRepoMock.findByPlateAndCompanyId.mockResolvedValue(vehicle);
    entryDenialRepoMock.create.mockResolvedValue(denial);

    const result = await useCase.execute(
      actor,
      new RegisterEntryDenialInputDto(
        'ABC1D23',
        EntryDenialReason.UNREGISTERED,
      ),
    );

    expect(createBlockRequestUseCaseMock.execute).not.toHaveBeenCalled();
    expect(result.blockRequest).toBeNull();
  });

  it('lança 403 ao pedir bloqueio sem a permissão específica', async () => {
    const restricted: AuthenticatedUserEntity = {
      ...actor,
      permissions: [PermissionCode.REGISTER_DENIAL],
    };

    await expect(
      useCase.execute(
        restricted,
        new RegisterEntryDenialInputDto(
          'ABC1D23',
          EntryDenialReason.OTHER,
          'Sem autorização',
          undefined,
          undefined,
          undefined,
          true,
        ),
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(entryDenialRepoMock.create).not.toHaveBeenCalled();
  });

  it('mantém o impedimento quando o pedido de bloqueio falha (pendente duplicado)', async () => {
    vehicleBlockRepoMock.findByIdAndCompanyId.mockResolvedValue(block);
    vehicleRepoMock.findByPlateAndCompanyId.mockResolvedValue(vehicle);
    entryDenialRepoMock.create.mockResolvedValue(denial);
    createBlockRequestUseCaseMock.execute.mockRejectedValue(
      new ConflictException(
        'Já existe uma solicitação de bloqueio pendente para esta placa.',
      ),
    );

    const result = await useCase.execute(
      actor,
      new RegisterEntryDenialInputDto(
        'ABC1D23',
        EntryDenialReason.BLOCKED,
        'Veículo em ocorrência',
        block.id,
        undefined,
        undefined,
        true,
      ),
    );

    expect(result.id).toBe(denial.id);
    expect(result.blockRequest).toBeNull();
    expect(result.blockRequestError).toBe(
      'Já existe uma solicitação de bloqueio pendente para esta placa.',
    );
  });
});
