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
import { UpdateDepartmentInputDto } from '../../application/dto/update-department-input.dto';

// Use case
import { UpdateDepartmentUseCase } from '../../application/use-cases/update-department.use-case';

describe('UpdateDepartmentUseCase', () => {
  let useCase: UpdateDepartmentUseCase;

  const departmentRepoMock = {
    findByIdAndCompanyId: jest.fn(),
    updateByIdAndCompanyId: jest.fn(),
  } as jest.Mocked<
    Pick<
      DepartmentRepository,
      'findByIdAndCompanyId' | 'updateByIdAndCompanyId'
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
        UpdateDepartmentUseCase,
        { provide: DEPARTMENT_REPOSITORY, useValue: departmentRepoMock },
      ],
    }).compile();
    useCase = module.get(UpdateDepartmentUseCase);
  });

  it('atualiza nome/descrição/vagas do departamento (PATCH parcial)', async () => {
    departmentRepoMock.findByIdAndCompanyId.mockResolvedValue(existing);
    departmentRepoMock.updateByIdAndCompanyId.mockResolvedValue({
      ...existing,
      name: 'Recepção Central',
      description: 'Atendimento',
      parkingSpace: 40,
    });

    const result = await useCase.execute(
      actor,
      new UpdateDepartmentInputDto(
        existing.id,
        'Recepção Central',
        'Atendimento',
        40,
      ),
    );

    expect(departmentRepoMock.updateByIdAndCompanyId).toHaveBeenCalledWith(
      existing.id,
      actor.companyId,
      {
        name: 'Recepção Central',
        description: 'Atendimento',
        parkingSpace: 40,
        isActive: undefined,
      },
    );
    expect(result).toMatchObject({
      id: existing.id,
      name: 'Recepção Central',
      parkingSpace: 40,
    });
  });

  it('reativa um departamento via PATCH com isActive true (ADR 0006 §2)', async () => {
    departmentRepoMock.findByIdAndCompanyId.mockResolvedValue({
      ...existing,
      isActive: false,
    });
    departmentRepoMock.updateByIdAndCompanyId.mockResolvedValue({
      ...existing,
      isActive: true,
    });

    const result = await useCase.execute(
      actor,
      new UpdateDepartmentInputDto(
        existing.id,
        undefined,
        undefined,
        undefined,
        true,
      ),
    );

    expect(departmentRepoMock.updateByIdAndCompanyId).toHaveBeenCalledWith(
      existing.id,
      actor.companyId,
      {
        name: undefined,
        description: undefined,
        parkingSpace: undefined,
        isActive: true,
      },
    );
    expect(result.isActive).toBe(true);
  });

  it('lança NotFoundException quando o departamento não existe na empresa', async () => {
    departmentRepoMock.findByIdAndCompanyId.mockResolvedValue(null);

    await expect(
      useCase.execute(
        actor,
        new UpdateDepartmentInputDto(
          '40000000-0000-0000-0000-000000000099',
          'Outro',
        ),
      ),
    ).rejects.toThrow(NotFoundException);
    expect(departmentRepoMock.updateByIdAndCompanyId).not.toHaveBeenCalled();
  });
});
