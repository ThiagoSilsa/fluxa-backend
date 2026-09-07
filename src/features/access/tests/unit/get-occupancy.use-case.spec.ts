// NestJS
import { Test } from '@nestjs/testing';

// Shared
import { PermissionCode } from '../../../../shared/constants/access-control.constant';

// Constants
import { UserType } from '../../../auth/domain/constants/user-type.constant';

// Types
import type { AuthenticatedUserEntity } from '../../../auth/domain/entities/authenticated-user.entity';
import type { DepartmentEntity } from '../../../departments/domain/entities/department.entity';
import type { VehicleAccessRepository } from '../../domain/repositories/vehicle-access.repository';
import type { DepartmentRepository } from '../../../departments/domain/repositories/department.repository';

// Repositories
import { VEHICLE_ACCESS_REPOSITORY } from '../../domain/repositories/vehicle-access.repository';
import { DEPARTMENT_REPOSITORY } from '../../../departments/domain/repositories/department.repository';

// Use case
import { GetOccupancyUseCase } from '../../application/use-cases/get-occupancy.use-case';

describe('GetOccupancyUseCase', () => {
  let useCase: GetOccupancyUseCase;

  const accessRepoMock = {
    countInsideByDepartmentIdAndCompanyId: jest.fn(),
    countInsideByCompanyId: jest.fn(),
  } as jest.Mocked<
    Pick<
      VehicleAccessRepository,
      'countInsideByDepartmentIdAndCompanyId' | 'countInsideByCompanyId'
    >
  >;

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
    permissions: [PermissionCode.VIEW_DASHBOARDS],
  };

  const reception: DepartmentEntity = {
    id: '40000000-0000-0000-0000-000000000002',
    companyId: actor.companyId,
    name: 'Recepção',
    description: null,
    parkingSpace: 10,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const security: DepartmentEntity = {
    id: '40000000-0000-0000-0000-000000000003',
    companyId: actor.companyId,
    name: 'Segurança',
    description: null,
    parkingSpace: 5,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module = await Test.createTestingModule({
      providers: [
        GetOccupancyUseCase,
        { provide: VEHICLE_ACCESS_REPOSITORY, useValue: accessRepoMock },
        { provide: DEPARTMENT_REPOSITORY, useValue: departmentRepoMock },
      ],
    }).compile();
    useCase = module.get(GetOccupancyUseCase);
  });

  it('calcula ocupação total e por departamento ativo (regras 21–24)', async () => {
    departmentRepoMock.list.mockResolvedValue({
      data: [reception, security],
      count: 2,
    });
    accessRepoMock.countInsideByCompanyId.mockResolvedValue(12);
    accessRepoMock.countInsideByDepartmentIdAndCompanyId.mockImplementation(
      (id) => Promise.resolve(id === reception.id ? 8 : 4),
    );

    const result = await useCase.execute(actor);

    expect(departmentRepoMock.list).toHaveBeenCalledWith(actor.companyId, {
      isActive: true,
      limit: 100,
      offset: 0,
    });
    expect(result).toEqual({
      totalOccupied: 12,
      totalCapacity: 15,
      freeSlots: 3,
      byDepartment: [
        {
          departmentId: reception.id,
          name: 'Recepção',
          occupied: 8,
          capacity: 10,
        },
        {
          departmentId: security.id,
          name: 'Segurança',
          occupied: 4,
          capacity: 5,
        },
      ],
    });
  });

  it('freeSlots nunca fica negativo (lotação excedida)', async () => {
    departmentRepoMock.list.mockResolvedValue({
      data: [reception],
      count: 1,
    });
    accessRepoMock.countInsideByCompanyId.mockResolvedValue(12);
    accessRepoMock.countInsideByDepartmentIdAndCompanyId.mockResolvedValue(12);

    const result = await useCase.execute(actor);

    expect(result.freeSlots).toBe(0);
  });

  it('retorna ocupação zerada quando não há departamentos ativos', async () => {
    departmentRepoMock.list.mockResolvedValue({ data: [], count: 0 });
    accessRepoMock.countInsideByCompanyId.mockResolvedValue(0);

    const result = await useCase.execute(actor);

    expect(result).toEqual({
      totalOccupied: 0,
      totalCapacity: 0,
      freeSlots: 0,
      byDepartment: [],
    });
  });
});
