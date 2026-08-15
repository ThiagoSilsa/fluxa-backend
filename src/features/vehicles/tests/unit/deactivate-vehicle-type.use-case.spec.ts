// NestJS
import { NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';

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
import { GetVehicleTypeInputDto } from '../../application/dto/get-vehicle-type-input.dto';

// Use case
import { DeactivateVehicleTypeUseCase } from '../../application/use-cases/deactivate-vehicle-type.use-case';

describe('DeactivateVehicleTypeUseCase', () => {
  let useCase: DeactivateVehicleTypeUseCase;

  const vehicleTypeRepoMock = {
    findByIdAndCompanyId: jest.fn(),
    deactivateByIdAndCompanyId: jest.fn(),
  } as jest.Mocked<
    Pick<
      VehicleTypeRepository,
      'findByIdAndCompanyId' | 'deactivateByIdAndCompanyId'
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
        DeactivateVehicleTypeUseCase,
        { provide: VEHICLE_TYPE_REPOSITORY, useValue: vehicleTypeRepoMock },
      ],
    }).compile();
    useCase = module.get(DeactivateVehicleTypeUseCase);
  });

  it('desativa (soft) um tipo da empresa do ator', async () => {
    vehicleTypeRepoMock.findByIdAndCompanyId.mockResolvedValue(existing);
    vehicleTypeRepoMock.deactivateByIdAndCompanyId.mockResolvedValue({
      ...existing,
      isActive: false,
    });

    const result = await useCase.execute(
      actor,
      new GetVehicleTypeInputDto(existing.id),
    );

    expect(vehicleTypeRepoMock.deactivateByIdAndCompanyId).toHaveBeenCalledWith(
      existing.id,
      actor.companyId,
    );
    expect(result.isActive).toBe(false);
  });

  it('lança NotFoundException quando o tipo não existe na empresa', async () => {
    vehicleTypeRepoMock.findByIdAndCompanyId.mockResolvedValue(null);

    await expect(
      useCase.execute(
        actor,
        new GetVehicleTypeInputDto('40000000-0000-0000-0000-000000000099'),
      ),
    ).rejects.toThrow(NotFoundException);
    expect(
      vehicleTypeRepoMock.deactivateByIdAndCompanyId,
    ).not.toHaveBeenCalled();
  });
});
