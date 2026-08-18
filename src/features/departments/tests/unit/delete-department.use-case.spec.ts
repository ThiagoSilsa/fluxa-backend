// NestJS
import { ConflictException, NotFoundException } from '@nestjs/common';
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
import { DeleteDepartmentUseCase } from '../../application/use-cases/delete-department.use-case';

describe('DeleteDepartmentUseCase', () => {
  let useCase: DeleteDepartmentUseCase;

  const departmentRepoMock = {
    findByIdAndCompanyId: jest.fn(),
    countVehicleDepartmentsByDepartmentIdAndCompanyId: jest.fn(),
    deleteByIdAndCompanyId: jest.fn(),
  } as jest.Mocked<
    Pick<
      DepartmentRepository,
      | 'findByIdAndCompanyId'
      | 'countVehicleDepartmentsByDepartmentIdAndCompanyId'
      | 'deleteByIdAndCompanyId'
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
    permissions: [PermissionCode.MANAGE_DEPARTMENTS],
  };

  const existing: DepartmentEntity = {
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
        DeleteDepartmentUseCase,
        { provide: DEPARTMENT_REPOSITORY, useValue: departmentRepoMock },
      ],
    }).compile();
    useCase = module.get(DeleteDepartmentUseCase);
  });

  it('exclui fisicamente um departamento sem veículos da empresa do ator', async () => {
    departmentRepoMock.findByIdAndCompanyId.mockResolvedValue(existing);
    departmentRepoMock.countVehicleDepartmentsByDepartmentIdAndCompanyId.mockResolvedValue(
      0,
    );
    departmentRepoMock.deleteByIdAndCompanyId.mockResolvedValue(existing);

    await expect(
      useCase.execute(actor, new GetDepartmentInputDto(existing.id)),
    ).resolves.toBeUndefined();

    expect(
      departmentRepoMock.countVehicleDepartmentsByDepartmentIdAndCompanyId,
    ).toHaveBeenCalledWith(existing.id, actor.companyId);
    expect(departmentRepoMock.deleteByIdAndCompanyId).toHaveBeenCalledWith(
      existing.id,
      actor.companyId,
    );
  });

  it('lança ConflictException (409) quando há veículos vinculados ao departamento', async () => {
    departmentRepoMock.findByIdAndCompanyId.mockResolvedValue(existing);
    departmentRepoMock.countVehicleDepartmentsByDepartmentIdAndCompanyId.mockResolvedValue(
      2,
    );

    await expect(
      useCase.execute(actor, new GetDepartmentInputDto(existing.id)),
    ).rejects.toThrow(ConflictException);
    expect(departmentRepoMock.deleteByIdAndCompanyId).not.toHaveBeenCalled();
  });

  it('lança NotFoundException quando o departamento não existe na empresa', async () => {
    departmentRepoMock.findByIdAndCompanyId.mockResolvedValue(null);

    await expect(
      useCase.execute(
        actor,
        new GetDepartmentInputDto('40000000-0000-0000-0000-000000000099'),
      ),
    ).rejects.toThrow(NotFoundException);
    expect(
      departmentRepoMock.countVehicleDepartmentsByDepartmentIdAndCompanyId,
    ).not.toHaveBeenCalled();
    expect(departmentRepoMock.deleteByIdAndCompanyId).not.toHaveBeenCalled();
  });

  it('lança NotFoundException quando a exclusão não encontra o departamento', async () => {
    departmentRepoMock.findByIdAndCompanyId.mockResolvedValue(existing);
    departmentRepoMock.countVehicleDepartmentsByDepartmentIdAndCompanyId.mockResolvedValue(
      0,
    );
    departmentRepoMock.deleteByIdAndCompanyId.mockResolvedValue(null);

    await expect(
      useCase.execute(actor, new GetDepartmentInputDto(existing.id)),
    ).rejects.toThrow(NotFoundException);
  });
});
