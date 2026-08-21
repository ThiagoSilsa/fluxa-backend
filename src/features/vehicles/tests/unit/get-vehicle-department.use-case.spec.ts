// NestJS
import { NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';

// Shared
import { PermissionCode } from '../../../../shared/constants/access-control.constant';

// Constants
import { UserType } from '../../../auth/domain/constants/user-type.constant';

// Types
import type { AuthenticatedUserEntity } from '../../../auth/domain/entities/authenticated-user.entity';
import type { DepartmentEntity } from '../../../departments/domain/entities/department.entity';
import type { DepartmentRepository } from '../../../departments/domain/repositories/department.repository';
import type { VehicleWithTypeEntity } from '../../domain/entities/vehicle.entity';
import type { VehicleDepartmentEntity } from '../../domain/entities/vehicle-department.entity';
import type { VehicleDepartmentRepository } from '../../domain/repositories/vehicle-department.repository';
import type { VehicleRepository } from '../../domain/repositories/vehicle.repository';

// Repositories
import { DEPARTMENT_REPOSITORY } from '../../../departments/domain/repositories/department.repository';
import { VEHICLE_DEPARTMENT_REPOSITORY } from '../../domain/repositories/vehicle-department.repository';
import { VEHICLE_REPOSITORY } from '../../domain/repositories/vehicle.repository';

// DTO
import { GetVehicleDepartmentInputDto } from '../../application/dto/get-vehicle-department-input.dto';

// Use case
import { GetVehicleDepartmentUseCase } from '../../application/use-cases/get-vehicle-department.use-case';

describe('GetVehicleDepartmentUseCase', () => {
  let useCase: GetVehicleDepartmentUseCase;

  const vehicleRepoMock = {
    findByIdAndCompanyId: jest.fn(),
  } as jest.Mocked<Pick<VehicleRepository, 'findByIdAndCompanyId'>>;

  const vehicleDepartmentRepoMock = {
    findActiveByVehicleIdAndCompanyId: jest.fn(),
  } as jest.Mocked<
    Pick<VehicleDepartmentRepository, 'findActiveByVehicleIdAndCompanyId'>
  >;

  const departmentRepoMock = {
    findByIdAndCompanyId: jest.fn(),
  } as jest.Mocked<Pick<DepartmentRepository, 'findByIdAndCompanyId'>>;

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
  const departmentId = '40000000-0000-0000-0000-000000000003';

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

  const department: DepartmentEntity = {
    id: departmentId,
    companyId: actor.companyId,
    name: 'Recepção',
    description: null,
    parkingSpace: 30,
    isActive: true,
    createdAt: new Date('2026-08-15T00:00:00Z'),
    updatedAt: new Date('2026-08-15T00:00:00Z'),
  };

  const link: VehicleDepartmentEntity = {
    id: '60000000-0000-0000-0000-000000000001',
    companyId: actor.companyId,
    vehicleId,
    departmentId,
    isActive: true,
    createdAt: new Date('2026-08-15T00:00:00Z'),
    updatedAt: new Date('2026-08-15T00:00:00Z'),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module = await Test.createTestingModule({
      providers: [
        GetVehicleDepartmentUseCase,
        { provide: VEHICLE_REPOSITORY, useValue: vehicleRepoMock },
        {
          provide: VEHICLE_DEPARTMENT_REPOSITORY,
          useValue: vehicleDepartmentRepoMock,
        },
        { provide: DEPARTMENT_REPOSITORY, useValue: departmentRepoMock },
      ],
    }).compile();
    useCase = module.get(GetVehicleDepartmentUseCase);
  });

  it('devolve o vínculo ativo com o departamento resolvido', async () => {
    vehicleRepoMock.findByIdAndCompanyId.mockResolvedValue(vehicle);
    vehicleDepartmentRepoMock.findActiveByVehicleIdAndCompanyId.mockResolvedValue(
      link,
    );
    departmentRepoMock.findByIdAndCompanyId.mockResolvedValue(department);

    const result = await useCase.execute(
      actor,
      new GetVehicleDepartmentInputDto(vehicleId),
    );

    expect(result).toMatchObject({
      id: link.id,
      vehicleId,
      department: { id: departmentId, name: 'Recepção' },
      isActive: true,
    });
  });

  it('lança NotFoundException quando o veículo não existe na empresa', async () => {
    vehicleRepoMock.findByIdAndCompanyId.mockResolvedValue(null);

    await expect(
      useCase.execute(actor, new GetVehicleDepartmentInputDto(vehicleId)),
    ).rejects.toThrow(NotFoundException);
  });

  it('lança NotFoundException quando não há vínculo ativo', async () => {
    vehicleRepoMock.findByIdAndCompanyId.mockResolvedValue(vehicle);
    vehicleDepartmentRepoMock.findActiveByVehicleIdAndCompanyId.mockResolvedValue(
      null,
    );

    await expect(
      useCase.execute(actor, new GetVehicleDepartmentInputDto(vehicleId)),
    ).rejects.toThrow(NotFoundException);
  });
});
