// NestJS
import { NotFoundException } from '@nestjs/common';
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
import { GetDepartmentInputDto } from '../../application/dto/get-department-input.dto';

// Use case
import { GetDepartmentUseCase } from '../../application/use-cases/get-department.use-case';

describe('GetDepartmentUseCase', () => {
  let useCase: GetDepartmentUseCase;

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
    permissions: [PermissionCode.MANAGE_DEPARTMENTS],
  };

  const department: DepartmentEntity = {
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
        GetDepartmentUseCase,
        { provide: DEPARTMENT_REPOSITORY, useValue: departmentRepoMock },
      ],
    }).compile();
    useCase = module.get(GetDepartmentUseCase);
  });

  it('detalha um departamento da empresa do ator', async () => {
    departmentRepoMock.findByIdAndCompanyId.mockResolvedValue(department);

    const result = await useCase.execute(
      actor,
      new GetDepartmentInputDto(department.id),
    );

    expect(departmentRepoMock.findByIdAndCompanyId).toHaveBeenCalledWith(
      department.id,
      actor.companyId,
    );
    expect(result).toEqual({
      id: department.id,
      name: 'Recepção',
      description: null,
      parkingSpace: 30,
      isActive: true,
    });
  });

  it('lança NotFoundException quando o departamento não existe na empresa (cross-tenant incluso)', async () => {
    departmentRepoMock.findByIdAndCompanyId.mockResolvedValue(null);

    await expect(
      useCase.execute(
        actor,
        new GetDepartmentInputDto('40000000-0000-0000-0000-000000000099'),
      ),
    ).rejects.toThrow(NotFoundException);
  });
});
