// NestJS
import { Test } from '@nestjs/testing';

// Shared
import { PermissionCode } from '../../../../shared/constants/access-control.constant';

// Constants
import { UserType } from '../../../auth/domain/constants/user-type.constant';

// Types
import type { AuthenticatedUserEntity } from '../../../auth/domain/entities/authenticated-user.entity';
import type { DepartmentEntity } from '../../domain/entities/department.entity';
import type { DepartmentRepository } from '../../domain/repositories/department.repository';

// Repository
import { DEPARTMENT_REPOSITORY } from '../../domain/repositories/department.repository';

// DTO
import { ListDepartmentsInputDto } from '../../application/dto/list-departments-input.dto';

// Use case
import { ListDepartmentsUseCase } from '../../application/use-cases/list-departments.use-case';

describe('ListDepartmentsUseCase', () => {
  let useCase: ListDepartmentsUseCase;

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
    permissions: [PermissionCode.MANAGE_DEPARTMENTS],
  };

  const departments: DepartmentEntity[] = [
    {
      id: '40000000-0000-0000-0000-000000000001',
      companyId: actor.companyId,
      name: 'Recepção',
      description: null,
      parkingSpace: 30,
      isActive: true,
      createdAt: new Date('2026-08-15T00:00:00Z'),
      updatedAt: new Date('2026-08-15T00:00:00Z'),
    },
    {
      id: '40000000-0000-0000-0000-000000000002',
      companyId: actor.companyId,
      name: 'Estacionamento',
      description: null,
      parkingSpace: 60,
      isActive: true,
      createdAt: new Date('2026-08-15T00:00:00Z'),
      updatedAt: new Date('2026-08-15T00:00:00Z'),
    },
  ];

  beforeEach(async () => {
    jest.clearAllMocks();
    const module = await Test.createTestingModule({
      providers: [
        ListDepartmentsUseCase,
        { provide: DEPARTMENT_REPOSITORY, useValue: departmentRepoMock },
      ],
    }).compile();
    useCase = module.get(ListDepartmentsUseCase);
  });

  it('lista departamentos da empresa com paginação no formato padrão', async () => {
    departmentRepoMock.list.mockResolvedValue({
      data: departments,
      count: 2,
    });

    const result = await useCase.execute(
      actor,
      new ListDepartmentsInputDto(undefined, undefined, 20, 0),
    );

    expect(departmentRepoMock.list).toHaveBeenCalledWith(actor.companyId, {
      search: undefined,
      isActive: undefined,
      limit: 20,
      offset: 0,
    });
    expect(result).toEqual({
      limit: 20,
      offset: 0,
      count: 2,
      data: departments.map((department) => ({
        id: department.id,
        name: department.name,
        description: department.description,
        parkingSpace: department.parkingSpace,
        isActive: department.isActive,
      })),
    });
  });

  it('repassa busca e filtro de estado para o repositório', async () => {
    departmentRepoMock.list.mockResolvedValue({ data: [], count: 0 });

    await useCase.execute(
      actor,
      new ListDepartmentsInputDto('Recep', true, 10, 5),
    );

    expect(departmentRepoMock.list).toHaveBeenCalledWith(actor.companyId, {
      search: 'Recep',
      isActive: true,
      limit: 10,
      offset: 5,
    });
  });
});
