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
import type { UserVehicleWithUserEntity } from '../../domain/entities/user-vehicle.entity';
import type { VehicleRepository } from '../../domain/repositories/vehicle.repository';
import type { VehicleDepartmentRepository } from '../../domain/repositories/vehicle-department.repository';
import type { UserVehicleRepository } from '../../domain/repositories/user-vehicle.repository';

// Repositories
import { DEPARTMENT_REPOSITORY } from '../../../departments/domain/repositories/department.repository';
import { USER_VEHICLE_REPOSITORY } from '../../domain/repositories/user-vehicle.repository';
import { VEHICLE_DEPARTMENT_REPOSITORY } from '../../domain/repositories/vehicle-department.repository';
import { VEHICLE_REPOSITORY } from '../../domain/repositories/vehicle.repository';

// DTO
import { GetVehicleInputDto } from '../../application/dto/get-vehicle-input.dto';

// Use case
import { GetVehicleUseCase } from '../../application/use-cases/get-vehicle.use-case';

describe('GetVehicleUseCase', () => {
  let useCase: GetVehicleUseCase;

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

  const userVehicleRepoMock = {
    findByVehicleIdAndCompanyId: jest.fn(),
  } as jest.Mocked<Pick<UserVehicleRepository, 'findByVehicleIdAndCompanyId'>>;

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

  const vehicle: VehicleWithTypeEntity = {
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

  const link: VehicleDepartmentEntity = {
    id: '60000000-0000-0000-0000-000000000001',
    companyId: actor.companyId,
    vehicleId: vehicle.id,
    departmentId: '40000000-0000-0000-0000-000000000003',
    isActive: true,
    createdAt: new Date('2026-08-15T00:00:00Z'),
    updatedAt: new Date('2026-08-15T00:00:00Z'),
  };

  const department: DepartmentEntity = {
    id: link.departmentId,
    companyId: actor.companyId,
    name: 'Recepção',
    description: null,
    parkingSpace: 30,
    isActive: true,
    createdAt: new Date('2026-08-15T00:00:00Z'),
    updatedAt: new Date('2026-08-15T00:00:00Z'),
  };

  const drivers: UserVehicleWithUserEntity[] = [
    {
      id: '60000000-0000-0000-0000-000000000002',
      companyId: actor.companyId,
      userId: '30000000-0000-0000-0000-000000000001',
      vehicleId: vehicle.id,
      isPrimary: true,
      canDrive: true,
      createdAt: new Date('2026-08-15T00:00:00Z'),
      updatedAt: new Date('2026-08-15T00:00:00Z'),
      user: {
        id: '30000000-0000-0000-0000-000000000001',
        name: 'Administrador',
      },
    },
  ];

  beforeEach(async () => {
    jest.clearAllMocks();
    const module = await Test.createTestingModule({
      providers: [
        GetVehicleUseCase,
        { provide: VEHICLE_REPOSITORY, useValue: vehicleRepoMock },
        {
          provide: VEHICLE_DEPARTMENT_REPOSITORY,
          useValue: vehicleDepartmentRepoMock,
        },
        { provide: DEPARTMENT_REPOSITORY, useValue: departmentRepoMock },
        { provide: USER_VEHICLE_REPOSITORY, useValue: userVehicleRepoMock },
      ],
    }).compile();
    useCase = module.get(GetVehicleUseCase);
  });

  it('detalha um veículo com o agregado (tipo + departamento padrão + motoristas)', async () => {
    vehicleRepoMock.findByIdAndCompanyId.mockResolvedValue(vehicle);
    vehicleDepartmentRepoMock.findActiveByVehicleIdAndCompanyId.mockResolvedValue(
      link,
    );
    departmentRepoMock.findByIdAndCompanyId.mockResolvedValue(department);
    userVehicleRepoMock.findByVehicleIdAndCompanyId.mockResolvedValue(drivers);

    const result = await useCase.execute(
      actor,
      new GetVehicleInputDto(vehicle.id),
    );

    expect(vehicleRepoMock.findByIdAndCompanyId).toHaveBeenCalledWith(
      vehicle.id,
      actor.companyId,
    );
    expect(result).toMatchObject({
      id: vehicle.id,
      plate: 'ABC1D23',
      vehicleType: { code: 'FROTA' },
      department: { id: department.id, name: 'Recepção' },
      drivers: [
        {
          id: drivers[0].id,
          user: { id: drivers[0].userId, name: 'Administrador' },
          isPrimary: true,
          canDrive: true,
        },
      ],
    });
  });

  it('devolve department null e drivers vazio quando não há vínculos', async () => {
    vehicleRepoMock.findByIdAndCompanyId.mockResolvedValue(vehicle);
    vehicleDepartmentRepoMock.findActiveByVehicleIdAndCompanyId.mockResolvedValue(
      null,
    );
    userVehicleRepoMock.findByVehicleIdAndCompanyId.mockResolvedValue([]);

    const result = await useCase.execute(
      actor,
      new GetVehicleInputDto(vehicle.id),
    );

    expect(result.department).toBeNull();
    expect(result.drivers).toEqual([]);
  });

  it('lança NotFoundException quando o veículo não existe na empresa (cross-tenant incluso)', async () => {
    vehicleRepoMock.findByIdAndCompanyId.mockResolvedValue(null);

    await expect(
      useCase.execute(
        actor,
        new GetVehicleInputDto('50000000-0000-0000-0000-000000000099'),
      ),
    ).rejects.toThrow(NotFoundException);
  });
});
