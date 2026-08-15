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
import type { VehicleDepartmentRepository } from '../../domain/repositories/vehicle-department.repository';
import type { VehicleRepository } from '../../domain/repositories/vehicle.repository';

// Repositories
import { VEHICLE_DEPARTMENT_REPOSITORY } from '../../domain/repositories/vehicle-department.repository';
import { VEHICLE_REPOSITORY } from '../../domain/repositories/vehicle.repository';

// DTO
import { RemoveVehicleDepartmentInputDto } from '../../application/dto/remove-vehicle-department-input.dto';

// Use case
import { RemoveVehicleDepartmentUseCase } from '../../application/use-cases/remove-vehicle-department.use-case';

describe('RemoveVehicleDepartmentUseCase', () => {
  let useCase: RemoveVehicleDepartmentUseCase;

  const vehicleRepoMock = {
    findByIdAndCompanyId: jest.fn(),
  } as jest.Mocked<Pick<VehicleRepository, 'findByIdAndCompanyId'>>;

  const vehicleDepartmentRepoMock = {
    deactivateByVehicleIdAndCompanyId: jest.fn(),
  } as jest.Mocked<
    Pick<VehicleDepartmentRepository, 'deactivateByVehicleIdAndCompanyId'>
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

  const vehicleId = '50000000-0000-0000-0000-000000000001';

  const vehicle: VehicleWithTypeEntity = {
    id: vehicleId,
    plate: 'ABC1D23',
    companyId: actor.companyId,
    model: null,
    color: null,
    observation: null,
    isBlocked: false,
    freePass: false,
    vehicleTypeId: '40000000-0000-0000-0000-000000000001',
    vehicleType: null,
    isActive: true,
    createdAt: new Date('2026-08-15T00:00:00Z'),
    updatedAt: new Date('2026-08-15T00:00:00Z'),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module = await Test.createTestingModule({
      providers: [
        RemoveVehicleDepartmentUseCase,
        { provide: VEHICLE_REPOSITORY, useValue: vehicleRepoMock },
        {
          provide: VEHICLE_DEPARTMENT_REPOSITORY,
          useValue: vehicleDepartmentRepoMock,
        },
      ],
    }).compile();
    useCase = module.get(RemoveVehicleDepartmentUseCase);
  });

  it('desativa o vínculo (idempotente) — veículo fica sem departamento padrão', async () => {
    vehicleRepoMock.findByIdAndCompanyId.mockResolvedValue(vehicle);
    vehicleDepartmentRepoMock.deactivateByVehicleIdAndCompanyId.mockResolvedValue(
      null,
    );

    await useCase.execute(
      actor,
      new RemoveVehicleDepartmentInputDto(vehicleId),
    );

    expect(
      vehicleDepartmentRepoMock.deactivateByVehicleIdAndCompanyId,
    ).toHaveBeenCalledWith(vehicleId, actor.companyId);
  });

  it('lança NotFoundException quando o veículo não existe na empresa', async () => {
    vehicleRepoMock.findByIdAndCompanyId.mockResolvedValue(null);

    await expect(
      useCase.execute(actor, new RemoveVehicleDepartmentInputDto(vehicleId)),
    ).rejects.toThrow(NotFoundException);
    expect(
      vehicleDepartmentRepoMock.deactivateByVehicleIdAndCompanyId,
    ).not.toHaveBeenCalled();
  });
});
