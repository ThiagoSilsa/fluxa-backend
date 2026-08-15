// NestJS
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
import type { VehicleTypeEntity } from '../../domain/entities/vehicle-type.entity';
import type { VehicleRepository } from '../../domain/repositories/vehicle.repository';
import type { VehicleTypeRepository } from '../../domain/repositories/vehicle-type.repository';

// Repositories
import { DEPARTMENT_REPOSITORY } from '../../../departments/domain/repositories/department.repository';
import { VEHICLE_REPOSITORY } from '../../domain/repositories/vehicle.repository';
import { VEHICLE_TYPE_REPOSITORY } from '../../domain/repositories/vehicle-type.repository';

// DTO
import { ListVehiclesInputDto } from '../../application/dto/list-vehicles-input.dto';

// Use case
import { ListVehiclesUseCase } from '../../application/use-cases/list-vehicles.use-case';

describe('ListVehiclesUseCase', () => {
  let useCase: ListVehiclesUseCase;

  const vehicleRepoMock = {
    list: jest.fn(),
  } as jest.Mocked<Pick<VehicleRepository, 'list'>>;

  const vehicleTypeRepoMock = {
    list: jest.fn(),
  } as jest.Mocked<Pick<VehicleTypeRepository, 'list'>>;

  const departmentRepoMock = {
    list: jest.fn(),
  } as jest.Mocked<Pick<DepartmentRepository, 'list'>>;

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

  const department: DepartmentEntity = {
    id: '40000000-0000-0000-0000-000000000003',
    companyId: actor.companyId,
    name: 'Recepção',
    description: null,
    parkingSpace: 30,
    isActive: true,
    createdAt: new Date('2026-08-15T00:00:00Z'),
    updatedAt: new Date('2026-08-15T00:00:00Z'),
  };

  const vehicles: VehicleWithTypeEntity[] = [
    {
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
    },
  ];

  beforeEach(async () => {
    jest.clearAllMocks();
    const module = await Test.createTestingModule({
      providers: [
        ListVehiclesUseCase,
        { provide: VEHICLE_REPOSITORY, useValue: vehicleRepoMock },
        { provide: VEHICLE_TYPE_REPOSITORY, useValue: vehicleTypeRepoMock },
        { provide: DEPARTMENT_REPOSITORY, useValue: departmentRepoMock },
      ],
    }).compile();
    useCase = module.get(ListVehiclesUseCase);
  });

  it('lista veículos com paginação e parameters de tipos e departamentos ativos', async () => {
    vehicleRepoMock.list.mockResolvedValue({ data: vehicles, count: 1 });
    vehicleTypeRepoMock.list.mockResolvedValue({
      data: [vehicleType],
      count: 1,
    });
    departmentRepoMock.list.mockResolvedValue({ data: [department], count: 1 });

    const result = await useCase.execute(
      actor,
      new ListVehiclesInputDto(
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        20,
        0,
      ),
    );

    expect(vehicleRepoMock.list).toHaveBeenCalledWith(actor.companyId, {
      search: undefined,
      vehicleTypeId: undefined,
      departmentId: undefined,
      freePass: undefined,
      isActive: undefined,
      limit: 20,
      offset: 0,
    });
    expect(result).toEqual({
      limit: 20,
      offset: 0,
      count: 1,
      data: [
        {
          id: vehicles[0].id,
          plate: 'ABC1D23',
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
        },
      ],
      parameters: [
        {
          key: 'vehicle_type_id',
          label: 'Tipo de veículo',
          allowed_values: [{ id: vehicleType.id, name: 'Frota' }],
        },
        {
          key: 'department_id',
          label: 'Departamento',
          allowed_values: [{ id: department.id, name: 'Recepção' }],
        },
      ],
    });
  });

  it('repassa busca, filtros e paginação para o repositório', async () => {
    vehicleRepoMock.list.mockResolvedValue({ data: [], count: 0 });
    vehicleTypeRepoMock.list.mockResolvedValue({ data: [], count: 0 });
    departmentRepoMock.list.mockResolvedValue({ data: [], count: 0 });

    await useCase.execute(
      actor,
      new ListVehiclesInputDto(
        'abc',
        vehicleType.id,
        department.id,
        true,
        true,
        10,
        5,
      ),
    );

    expect(vehicleRepoMock.list).toHaveBeenCalledWith(actor.companyId, {
      search: 'abc',
      vehicleTypeId: vehicleType.id,
      departmentId: department.id,
      freePass: true,
      isActive: true,
      limit: 10,
      offset: 5,
    });
  });
});
