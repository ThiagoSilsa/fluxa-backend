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
import type { VehicleWithTypeEntity } from '../../domain/entities/vehicle.entity';
import type { VehicleTypeEntity } from '../../domain/entities/vehicle-type.entity';
import type { VehicleRepository } from '../../domain/repositories/vehicle.repository';
import type { VehicleTypeRepository } from '../../domain/repositories/vehicle-type.repository';

// Repositories
import { VEHICLE_REPOSITORY } from '../../domain/repositories/vehicle.repository';
import { VEHICLE_TYPE_REPOSITORY } from '../../domain/repositories/vehicle-type.repository';

// DTO
import { UpdateVehicleInputDto } from '../../application/dto/update-vehicle-input.dto';

// Use case
import { UpdateVehicleUseCase } from '../../application/use-cases/update-vehicle.use-case';

describe('UpdateVehicleUseCase', () => {
  let useCase: UpdateVehicleUseCase;

  const vehicleRepoMock = {
    findByIdAndCompanyId: jest.fn(),
    updateByIdAndCompanyId: jest.fn(),
  } as jest.Mocked<
    Pick<VehicleRepository, 'findByIdAndCompanyId' | 'updateByIdAndCompanyId'>
  >;

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

  const existing: VehicleWithTypeEntity = {
    id: '50000000-0000-0000-0000-000000000001',
    plate: 'ABC1D23',
    companyId: actor.companyId,
    model: 'Onix',
    color: 'Prata',
    observation: null,
    isBlocked: false,
    freePass: false,
    vehicleTypeId: vehicleType.id,
    vehicleType: {
      id: vehicleType.id,
      code: 'FROTA',
      name: 'Frota',
      isFleet: true,
    },
    isActive: true,
    createdAt: new Date('2026-08-15T00:00:00Z'),
    updatedAt: new Date('2026-08-15T00:00:00Z'),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module = await Test.createTestingModule({
      providers: [
        UpdateVehicleUseCase,
        { provide: VEHICLE_REPOSITORY, useValue: vehicleRepoMock },
        { provide: VEHICLE_TYPE_REPOSITORY, useValue: vehicleTypeRepoMock },
      ],
    }).compile();
    useCase = module.get(UpdateVehicleUseCase);
  });

  it('atualiza placa (normalizada)/modelo/cor/observação e devolve com o tipo', async () => {
    vehicleRepoMock.findByIdAndCompanyId
      .mockResolvedValueOnce(existing)
      .mockResolvedValueOnce({ ...existing, plate: 'XYZ2E45', model: 'Cruze' });
    vehicleRepoMock.updateByIdAndCompanyId.mockResolvedValue({
      ...existing,
      plate: 'XYZ2E45',
      model: 'Cruze',
    });

    const result = await useCase.execute(
      actor,
      new UpdateVehicleInputDto(existing.id, 'xyz-2e45', 'Cruze'),
    );

    expect(vehicleRepoMock.updateByIdAndCompanyId).toHaveBeenCalledWith(
      existing.id,
      actor.companyId,
      {
        plate: 'XYZ2E45',
        model: 'Cruze',
        color: undefined,
        observation: undefined,
        freePass: undefined,
        vehicleTypeId: undefined,
        isActive: undefined,
      },
    );
    expect(result).toMatchObject({ plate: 'XYZ2E45', model: 'Cruze' });
  });

  it('rejeita is_blocked enviado no body (400 — derivado, ADR 0006 §4)', async () => {
    vehicleRepoMock.findByIdAndCompanyId.mockResolvedValue(existing);

    await expect(
      useCase.execute(
        actor,
        new UpdateVehicleInputDto(
          existing.id,
          undefined,
          undefined,
          undefined,
          undefined,
          undefined,
          undefined,
          undefined,
          true,
        ),
      ),
    ).rejects.toThrow(BadRequestException);
    expect(vehicleRepoMock.updateByIdAndCompanyId).not.toHaveBeenCalled();
  });

  it('rejeita free_pass=true sem GRANT_FREE_PASS (403)', async () => {
    vehicleRepoMock.findByIdAndCompanyId.mockResolvedValue(existing);

    await expect(
      useCase.execute(
        actorWithoutFreePass,
        new UpdateVehicleInputDto(
          existing.id,
          undefined,
          undefined,
          undefined,
          undefined,
          true,
        ),
      ),
    ).rejects.toThrow(ForbiddenException);
    expect(vehicleRepoMock.updateByIdAndCompanyId).not.toHaveBeenCalled();
  });

  it('rejeita placa com formato inválido (400)', async () => {
    vehicleRepoMock.findByIdAndCompanyId.mockResolvedValue(existing);

    await expect(
      useCase.execute(actor, new UpdateVehicleInputDto(existing.id, 'ABC12')),
    ).rejects.toThrow(BadRequestException);
  });

  it('valida o novo tipo (404 inexistente / 400 inativo)', async () => {
    vehicleRepoMock.findByIdAndCompanyId.mockResolvedValue(existing);
    vehicleTypeRepoMock.findByIdAndCompanyId.mockResolvedValueOnce(null);

    await expect(
      useCase.execute(
        actor,
        new UpdateVehicleInputDto(
          existing.id,
          undefined,
          undefined,
          undefined,
          undefined,
          undefined,
          '40000000-0000-0000-0000-000000000099',
        ),
      ),
    ).rejects.toThrow(NotFoundException);

    vehicleTypeRepoMock.findByIdAndCompanyId.mockResolvedValueOnce({
      ...vehicleType,
      isActive: false,
    });
    await expect(
      useCase.execute(
        actor,
        new UpdateVehicleInputDto(
          existing.id,
          undefined,
          undefined,
          undefined,
          undefined,
          undefined,
          vehicleType.id,
        ),
      ),
    ).rejects.toThrow(BadRequestException);
  });

  it('reativa um veículo via PATCH com isActive true (ADR 0006 §2)', async () => {
    vehicleRepoMock.findByIdAndCompanyId
      .mockResolvedValueOnce({ ...existing, isActive: false })
      .mockResolvedValueOnce({ ...existing, isActive: true });
    vehicleRepoMock.updateByIdAndCompanyId.mockResolvedValue({
      ...existing,
      isActive: true,
    });

    const result = await useCase.execute(
      actor,
      new UpdateVehicleInputDto(
        existing.id,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        true,
      ),
    );

    expect(result.isActive).toBe(true);
  });

  it('traduz placa duplicada em ConflictException (409)', async () => {
    vehicleRepoMock.findByIdAndCompanyId.mockResolvedValue(existing);
    vehicleRepoMock.updateByIdAndCompanyId.mockRejectedValue(
      new QueryFailedError('duplicate', [], new Error('23505')),
    );

    await expect(
      useCase.execute(actor, new UpdateVehicleInputDto(existing.id, 'ABC1234')),
    ).rejects.toThrow(ConflictException);
  });

  it('lança NotFoundException quando o veículo não existe na empresa', async () => {
    vehicleRepoMock.findByIdAndCompanyId.mockResolvedValue(null);

    await expect(
      useCase.execute(
        actor,
        new UpdateVehicleInputDto(
          '50000000-0000-0000-0000-000000000099',
          'ABC1234',
        ),
      ),
    ).rejects.toThrow(NotFoundException);
    expect(vehicleRepoMock.updateByIdAndCompanyId).not.toHaveBeenCalled();
  });
});
