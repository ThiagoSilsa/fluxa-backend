// NestJS
import { ConflictException, NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { QueryFailedError } from 'typeorm';

// Shared
import { PermissionCode } from '../../../../shared/constants/access-control.constant';

// Constants
import { UserType } from '../../../auth/domain/constants/user-type.constant';

// Types
import type { AuthenticatedUserEntity } from '../../../auth/domain/entities/authenticated-user.entity';
import type { VehicleTypeEntity } from '../../domain/entities/vehicle-type.entity';
import type { VehicleTypeRepository } from '../../domain/repositories/vehicle-type.repository';

// Repository
import { VEHICLE_TYPE_REPOSITORY } from '../../domain/repositories/vehicle-type.repository';

// DTO
import { UpdateVehicleTypeInputDto } from '../../application/dto/update-vehicle-type-input.dto';

// Use case
import { UpdateVehicleTypeUseCase } from '../../application/use-cases/update-vehicle-type.use-case';

describe('UpdateVehicleTypeUseCase', () => {
  let useCase: UpdateVehicleTypeUseCase;

  const vehicleTypeRepoMock = {
    findByIdAndCompanyId: jest.fn(),
    updateByIdAndCompanyId: jest.fn(),
  } as jest.Mocked<
    Pick<
      VehicleTypeRepository,
      'findByIdAndCompanyId' | 'updateByIdAndCompanyId'
    >
  >;

  const actor: AuthenticatedUserEntity = {
    id: '30000000-0000-0000-0000-000000000001',
    companyId: '10000000-0000-0000-0000-000000000001',
    email: 'admin@somar.local',
    name: 'Administrador',
    type: UserType.EMPLOYEE,
    isAdmin: true,
    roleCodes: ['Administração'],
    permissions: [PermissionCode.MANAGE_VEHICLE_TYPES],
  };

  const existing: VehicleTypeEntity = {
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

  beforeEach(async () => {
    jest.clearAllMocks();
    const module = await Test.createTestingModule({
      providers: [
        UpdateVehicleTypeUseCase,
        { provide: VEHICLE_TYPE_REPOSITORY, useValue: vehicleTypeRepoMock },
      ],
    }).compile();
    useCase = module.get(UpdateVehicleTypeUseCase);
  });

  it('atualiza código (normalizado)/nome/descrição/classificação', async () => {
    vehicleTypeRepoMock.findByIdAndCompanyId.mockResolvedValue(existing);
    vehicleTypeRepoMock.updateByIdAndCompanyId.mockResolvedValue({
      ...existing,
      code: 'FROTA-CENTRAL',
      name: 'Frota Central',
    });

    const result = await useCase.execute(
      actor,
      new UpdateVehicleTypeInputDto(
        existing.id,
        ' frota-central ',
        'Frota Central',
        undefined,
        undefined,
        undefined,
      ),
    );

    expect(vehicleTypeRepoMock.updateByIdAndCompanyId).toHaveBeenCalledWith(
      existing.id,
      actor.companyId,
      {
        code: 'FROTA-CENTRAL',
        name: 'Frota Central',
        description: undefined,
        isFleet: undefined,
        isActive: undefined,
      },
    );
    expect(result).toMatchObject({ code: 'FROTA-CENTRAL' });
  });

  it('reativa um tipo via PATCH com isActive true (ADR 0006 §2)', async () => {
    vehicleTypeRepoMock.findByIdAndCompanyId.mockResolvedValue({
      ...existing,
      isActive: false,
    });
    vehicleTypeRepoMock.updateByIdAndCompanyId.mockResolvedValue({
      ...existing,
      isActive: true,
    });

    const result = await useCase.execute(
      actor,
      new UpdateVehicleTypeInputDto(
        existing.id,
        undefined,
        undefined,
        undefined,
        undefined,
        true,
      ),
    );

    expect(result.isActive).toBe(true);
  });

  it('lança NotFoundException quando o tipo não existe na empresa', async () => {
    vehicleTypeRepoMock.findByIdAndCompanyId.mockResolvedValue(null);

    await expect(
      useCase.execute(
        actor,
        new UpdateVehicleTypeInputDto(
          '40000000-0000-0000-0000-000000000099',
          'FROTA',
        ),
      ),
    ).rejects.toThrow(NotFoundException);
    expect(vehicleTypeRepoMock.updateByIdAndCompanyId).not.toHaveBeenCalled();
  });

  it('traduz violação de unique em ConflictException (409)', async () => {
    vehicleTypeRepoMock.findByIdAndCompanyId.mockResolvedValue(existing);
    vehicleTypeRepoMock.updateByIdAndCompanyId.mockRejectedValue(
      new QueryFailedError('duplicate', [], new Error('23505')),
    );

    await expect(
      useCase.execute(
        actor,
        new UpdateVehicleTypeInputDto(existing.id, 'PARTICULAR'),
      ),
    ).rejects.toThrow(ConflictException);
  });
});
