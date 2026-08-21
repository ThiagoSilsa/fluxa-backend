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
import { CreateDepartmentInputDto } from '../../application/dto/create-department-input.dto';

// Use case
import { CreateDepartmentUseCase } from '../../application/use-cases/create-department.use-case';

describe('CreateDepartmentUseCase', () => {
  let useCase: CreateDepartmentUseCase;

  const departmentRepoMock = {
    create: jest.fn(),
  } as jest.Mocked<Pick<DepartmentRepository, 'create'>>;

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

  const createdDepartment: DepartmentEntity = {
    id: '40000000-0000-0000-0000-000000000001',
    companyId: actor.companyId,
    name: 'Recepção',
    description: null,
    parkingSpace: 30,
    isActive: true,
    createdAt: new Date('2026-08-15T00:00:00Z'),
    updatedAt: new Date('2026-08-15T00:00:00Z'),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module = await Test.createTestingModule({
      providers: [
        CreateDepartmentUseCase,
        { provide: DEPARTMENT_REPOSITORY, useValue: departmentRepoMock },
      ],
    }).compile();
    useCase = module.get(CreateDepartmentUseCase);
  });

  it('cria o departamento na empresa da sessão com as vagas informadas', async () => {
    departmentRepoMock.create.mockResolvedValue(createdDepartment);

    const result = await useCase.execute(
      actor,
      new CreateDepartmentInputDto('Recepção', 30),
    );

    expect(departmentRepoMock.create).toHaveBeenCalledWith({
      companyId: actor.companyId,
      name: 'Recepção',
      description: null,
      parkingSpace: 30,
    });
    expect(result).toEqual({
      id: createdDepartment.id,
      name: 'Recepção',
      description: null,
      parkingSpace: 30,
      isActive: true,
    });
  });

  it('aceita 0 vagas (departamento sem vagas — ADR 0006 §7)', async () => {
    departmentRepoMock.create.mockResolvedValue({
      ...createdDepartment,
      parkingSpace: 0,
    });

    const result = await useCase.execute(
      actor,
      new CreateDepartmentInputDto('Sem Vagas', 0),
    );

    expect(departmentRepoMock.create).toHaveBeenCalledWith({
      companyId: actor.companyId,
      name: 'Sem Vagas',
      description: null,
      parkingSpace: 0,
    });
    expect(result.parkingSpace).toBe(0);
  });

  it('mantém a descrição informada', async () => {
    departmentRepoMock.create.mockResolvedValue({
      ...createdDepartment,
      description: 'Recepção principal',
    });

    await useCase.execute(
      actor,
      new CreateDepartmentInputDto('Recepção', 30, 'Recepção principal'),
    );

    expect(departmentRepoMock.create).toHaveBeenCalledWith({
      companyId: actor.companyId,
      name: 'Recepção',
      description: 'Recepção principal',
      parkingSpace: 30,
    });
  });
});
