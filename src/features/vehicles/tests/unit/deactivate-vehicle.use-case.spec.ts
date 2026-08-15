// NestJS
import { NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';

// Shared
import { PermissionCode } from '../../../../shared/constants/access-control.constant';

// Constants
import { UserType } from '../../../auth/domain/constants/user-type.constant';

// Types
import type { AuthenticatedUserEntity } from '../../../auth/domain/entities/authenticated-user.entity';
import type { VehicleWithTypeEntity } from '../../domain/entities/vehicle.entity';
import type { VehicleRepository } from '../../domain/repositories/vehicle.repository';

// Repository
import { VEHICLE_REPOSITORY } from '../../domain/repositories/vehicle.repository';

// DTO
import { GetVehicleInputDto } from '../../application/dto/get-vehicle-input.dto';

// Use case
import { DeactivateVehicleUseCase } from '../../application/use-cases/deactivate-vehicle.use-case';

describe('DeactivateVehicleUseCase', () => {
  let useCase: DeactivateVehicleUseCase;

  const vehicleRepoMock = {
    findByIdAndCompanyId: jest.fn(),
    deactivateByIdAndCompanyId: jest.fn(),
  } as jest.Mocked<
    Pick<
      VehicleRepository,
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
    permissions: [PermissionCode.MANAGE_VEHICLES],
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
    vehicleTypeId: '40000000-0000-0000-0000-000000000001',
    vehicleType: {
      id: '40000000-0000-0000-0000-000000000001',
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
        DeactivateVehicleUseCase,
        { provide: VEHICLE_REPOSITORY, useValue: vehicleRepoMock },
      ],
    }).compile();
    useCase = module.get(DeactivateVehicleUseCase);
  });

  it('desativa (soft) um veículo da empresa do ator, mantendo o tipo', async () => {
    vehicleRepoMock.findByIdAndCompanyId.mockResolvedValue(existing);
    vehicleRepoMock.deactivateByIdAndCompanyId.mockResolvedValue({
      ...existing,
      isActive: false,
    });

    const result = await useCase.execute(
      actor,
      new GetVehicleInputDto(existing.id),
    );

    expect(vehicleRepoMock.deactivateByIdAndCompanyId).toHaveBeenCalledWith(
      existing.id,
      actor.companyId,
    );
    expect(result.isActive).toBe(false);
    expect(result.vehicleType).toEqual(existing.vehicleType);
  });

  it('lança NotFoundException quando o veículo não existe na empresa', async () => {
    vehicleRepoMock.findByIdAndCompanyId.mockResolvedValue(null);

    await expect(
      useCase.execute(
        actor,
        new GetVehicleInputDto('50000000-0000-0000-0000-000000000099'),
      ),
    ).rejects.toThrow(NotFoundException);
    expect(vehicleRepoMock.deactivateByIdAndCompanyId).not.toHaveBeenCalled();
  });
});
