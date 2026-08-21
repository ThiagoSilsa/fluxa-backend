// NestJS
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { QueryFailedError } from 'typeorm';

// Shared
import { PermissionCode } from '../../../../shared/constants/access-control.constant';

// Constants
import { UserType } from '../../../auth/domain/constants/user-type.constant';

// Types
import type { AuthenticatedUserEntity } from '../../../auth/domain/entities/authenticated-user.entity';
import type { VehicleEntity } from '../../domain/entities/vehicle.entity';
import type { VehicleTypeEntity } from '../../domain/entities/vehicle-type.entity';
import type { VehicleRepository } from '../../domain/repositories/vehicle.repository';
import type { VehicleTypeRepository } from '../../domain/repositories/vehicle-type.repository';

// Repositories
import { VEHICLE_REPOSITORY } from '../../domain/repositories/vehicle.repository';
import { VEHICLE_TYPE_REPOSITORY } from '../../domain/repositories/vehicle-type.repository';

// DTO
import { CreateVehicleInputDto } from '../../application/dto/create-vehicle-input.dto';

// Use case
import { CreateVehicleUseCase } from '../../application/use-cases/create-vehicle.use-case';

describe('CreateVehicleUseCase', () => {
  let useCase: CreateVehicleUseCase;

  const vehicleRepoMock = {
    create: jest.fn(),
  } as jest.Mocked<Pick<VehicleRepository, 'create'>>;

  const vehicleTypeRepoMock = {
    findByIdAndCompanyId: jest.fn(),
  } as jest.Mocked<Pick<VehicleTypeRepository, 'findByIdAndCompanyId'>>;

  const actor: AuthenticatedUserEntity = {
    id: '30000000-0000-0000-0000-000000000001',
    companyId: '10000000-0000-0000-0000-000000000001',
    email: 'admin@somar.local',
    name: 'Administrador',
    type: UserType.EMPLOYEE,
    isAdmin: true,
    roleCodes: ['Administração'],
    permissions: [
      PermissionCode.MANAGE_VEHICLES,
      PermissionCode.GRANT_FREE_PASS,
    ],
  };

  const actorWithoutFreePass: AuthenticatedUserEntity = {
    ...actor,
    isAdmin: false,
    permissions: [PermissionCode.MANAGE_VEHICLES],
  };

  const vehicleType: VehicleTypeEntity = {
    id: '40000000-0000-0000-0000-000000000001',
    companyId: actor.companyId,
    code: 'FROTA',
    name: 'Frota',
    description: null,
    isFleet: true,
    isActive: true,
    createdAt: new Date('2026-08-15T00:00:00Z'),
    updatedAt: new Date('2026-08-15T00:00:00Z'),
  };

  const savedVehicle: VehicleEntity = {
    id: '50000000-0000-0000-0000-000000000001',
    plate: 'ABC1D23',
    companyId: actor.companyId,
    model: 'Onix',
    color: 'Prata',
    observation: null,
    isBlocked: false,
    freePass: false,
    vehicleTypeId: vehicleType.id,
    isActive: true,
    createdAt: new Date('2026-08-15T00:00:00Z'),
    updatedAt: new Date('2026-08-15T00:00:00Z'),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module = await Test.createTestingModule({
      providers: [
        CreateVehicleUseCase,
        { provide: VEHICLE_REPOSITORY, useValue: vehicleRepoMock },
        { provide: VEHICLE_TYPE_REPOSITORY, useValue: vehicleTypeRepoMock },
      ],
    }).compile();
    useCase = module.get(CreateVehicleUseCase);
  });

  it('cria o veículo com placa normalizada e o tipo agregado', async () => {
    vehicleTypeRepoMock.findByIdAndCompanyId.mockResolvedValue(vehicleType);
    vehicleRepoMock.create.mockResolvedValue(savedVehicle);

    const result = await useCase.execute(
      actor,
      new CreateVehicleInputDto(' abc-1d23 ', vehicleType.id, 'Onix', 'Prata'),
    );

    expect(vehicleRepoMock.create).toHaveBeenCalledWith({
      plate: 'ABC1D23',
      companyId: actor.companyId,
      model: 'Onix',
      color: 'Prata',
      observation: null,
      freePass: false,
      vehicleTypeId: vehicleType.id,
    });
    expect(result).toMatchObject({
      plate: 'ABC1D23',
      vehicleType: {
        id: vehicleType.id,
        code: 'FROTA',
        name: 'Frota',
        isFleet: true,
      },
    });
  });

  it('rejeita placa com formato inválido (400 — ADR 0006 §3)', async () => {
    await expect(
      useCase.execute(
        actor,
        new CreateVehicleInputDto('ABC12', vehicleType.id),
      ),
    ).rejects.toThrow(BadRequestException);
    expect(vehicleRepoMock.create).not.toHaveBeenCalled();
  });

  it('rejeita is_blocked enviado no body (400 — derivado, ADR 0006 §4)', async () => {
    await expect(
      useCase.execute(
        actor,
        new CreateVehicleInputDto(
          'ABC1234',
          vehicleType.id,
          undefined,
          undefined,
          undefined,
          false,
          true,
        ),
      ),
    ).rejects.toThrow(BadRequestException);
    expect(vehicleRepoMock.create).not.toHaveBeenCalled();
  });

  it('rejeita free_pass=true sem GRANT_FREE_PASS (403 — ADR 0006 §5)', async () => {
    await expect(
      useCase.execute(
        actorWithoutFreePass,
        new CreateVehicleInputDto(
          'ABC1234',
          vehicleType.id,
          undefined,
          undefined,
          undefined,
          true,
        ),
      ),
    ).rejects.toThrow(ForbiddenException);
    expect(vehicleRepoMock.create).not.toHaveBeenCalled();
  });

  it('permite free_pass=true com GRANT_FREE_PASS', async () => {
    vehicleTypeRepoMock.findByIdAndCompanyId.mockResolvedValue(vehicleType);
    vehicleRepoMock.create.mockResolvedValue({
      ...savedVehicle,
      freePass: true,
    });

    const result = await useCase.execute(
      actor,
      new CreateVehicleInputDto(
        'ABC1234',
        vehicleType.id,
        undefined,
        undefined,
        undefined,
        true,
      ),
    );

    expect(vehicleRepoMock.create).toHaveBeenCalledWith(
      expect.objectContaining({ freePass: true }),
    );
    expect(result.freePass).toBe(true);
  });

  it('rejeita tipo inexistente/outro tenant (404)', async () => {
    vehicleTypeRepoMock.findByIdAndCompanyId.mockResolvedValue(null);

    await expect(
      useCase.execute(
        actor,
        new CreateVehicleInputDto(
          'ABC1234',
          '40000000-0000-0000-0000-000000000099',
        ),
      ),
    ).rejects.toThrow(NotFoundException);
    expect(vehicleRepoMock.create).not.toHaveBeenCalled();
  });

  it('rejeita tipo inativo (400 — ADR 0006 §6)', async () => {
    vehicleTypeRepoMock.findByIdAndCompanyId.mockResolvedValue({
      ...vehicleType,
      isActive: false,
    });

    await expect(
      useCase.execute(
        actor,
        new CreateVehicleInputDto('ABC1234', vehicleType.id),
      ),
    ).rejects.toThrow(BadRequestException);
    expect(vehicleRepoMock.create).not.toHaveBeenCalled();
  });

  it('traduz placa duplicada em ConflictException (409)', async () => {
    vehicleTypeRepoMock.findByIdAndCompanyId.mockResolvedValue(vehicleType);
    vehicleRepoMock.create.mockRejectedValue(
      new QueryFailedError('duplicate', [], new Error('23505')),
    );

    await expect(
      useCase.execute(
        actor,
        new CreateVehicleInputDto('ABC1234', vehicleType.id),
      ),
    ).rejects.toThrow(ConflictException);
  });
});
