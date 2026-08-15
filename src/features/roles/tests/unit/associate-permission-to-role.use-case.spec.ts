// NestJS
import { ConflictException, NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';

// Shared
import { PermissionCode } from '../../../../shared/constants/access-control.constant';

// Constants
import { UserType } from '../../../auth/domain/constants/user-type.constant';

// Types
import type { AuthenticatedUserEntity } from '../../../auth/domain/entities/authenticated-user.entity';
import type { RoleEntity } from '../../domain/entities/role.entity';
import type { PermissionRepository } from '../../domain/repositories/permission.repository';
import type { RolePermissionRepository } from '../../domain/repositories/role-permission.repository';
import type { RoleRepository } from '../../domain/repositories/role.repository';

// Repository
import { PERMISSION_REPOSITORY } from '../../domain/repositories/permission.repository';
import { ROLE_PERMISSION_REPOSITORY } from '../../domain/repositories/role-permission.repository';
import { ROLE_REPOSITORY } from '../../domain/repositories/role.repository';

// DTO
import { AssociatePermissionInputDto } from '../../application/dto/associate-permission-input.dto';

// Use case
import { AssociatePermissionToRoleUseCase } from '../../application/use-cases/associate-permission-to-role.use-case';

describe('AssociatePermissionToRoleUseCase', () => {
  let useCase: AssociatePermissionToRoleUseCase;

  const roleRepoMock = {
    findByIdAndCompanyId: jest.fn(),
  } as jest.Mocked<Pick<RoleRepository, 'findByIdAndCompanyId'>>;

  const permissionRepoMock = {
    findById: jest.fn(),
  } as jest.Mocked<Pick<PermissionRepository, 'findById'>>;

  const rolePermissionRepoMock = {
    exists: jest.fn(),
    associate: jest.fn(),
  } as jest.Mocked<Pick<RolePermissionRepository, 'exists' | 'associate'>>;

  const actor: AuthenticatedUserEntity = {
    id: '30000000-0000-0000-0000-000000000001',
    companyId: '10000000-0000-0000-0000-000000000001',
    email: 'admin@somar.local',
    name: 'Administrador',
    type: UserType.EMPLOYEE,
    isAdmin: true,
    roleCodes: ['Administração'],
    permissions: [PermissionCode.MANAGE_ROLES],
  };

  const role: RoleEntity = {
    id: '40000000-0000-0000-0000-000000000001',
    companyId: actor.companyId,
    name: 'Porteiro',
    description: null,
    isAdmin: false,
    isActive: true,
    createdAt: new Date('2026-08-15T00:00:00Z'),
    updatedAt: new Date('2026-08-15T00:00:00Z'),
  };

  const permissionId = '90000000-0000-0000-0000-000000000001';

  beforeEach(async () => {
    jest.clearAllMocks();
    const module = await Test.createTestingModule({
      providers: [
        AssociatePermissionToRoleUseCase,
        { provide: ROLE_REPOSITORY, useValue: roleRepoMock },
        { provide: PERMISSION_REPOSITORY, useValue: permissionRepoMock },
        {
          provide: ROLE_PERMISSION_REPOSITORY,
          useValue: rolePermissionRepoMock,
        },
      ],
    }).compile();
    useCase = module.get(AssociatePermissionToRoleUseCase);
  });

  it('associa a permissão ao cargo da empresa e devolve a permissão vinculada', async () => {
    roleRepoMock.findByIdAndCompanyId.mockResolvedValue(role);
    permissionRepoMock.findById.mockResolvedValue({
      id: permissionId,
      code: 'REGISTER_ENTRY',
      description: null,
    });
    rolePermissionRepoMock.exists.mockResolvedValue(false);
    rolePermissionRepoMock.associate.mockResolvedValue(undefined);

    const result = await useCase.execute(
      actor,
      new AssociatePermissionInputDto(role.id, permissionId),
    );

    expect(rolePermissionRepoMock.associate).toHaveBeenCalledWith(
      actor.companyId,
      role.id,
      permissionId,
    );
    expect(result).toEqual({
      id: permissionId,
      code: 'REGISTER_ENTRY',
      description: null,
    });
  });

  it('lança NotFoundException quando o cargo não existe na empresa', async () => {
    roleRepoMock.findByIdAndCompanyId.mockResolvedValue(null);

    await expect(
      useCase.execute(
        actor,
        new AssociatePermissionInputDto(role.id, permissionId),
      ),
    ).rejects.toThrow(NotFoundException);
    expect(rolePermissionRepoMock.associate).not.toHaveBeenCalled();
  });

  it('lança NotFoundException quando a permissão não existe no catálogo', async () => {
    roleRepoMock.findByIdAndCompanyId.mockResolvedValue(role);
    permissionRepoMock.findById.mockResolvedValue(null);

    await expect(
      useCase.execute(
        actor,
        new AssociatePermissionInputDto(role.id, permissionId),
      ),
    ).rejects.toThrow(NotFoundException);
    expect(rolePermissionRepoMock.associate).not.toHaveBeenCalled();
  });

  it('lança ConflictException quando o vínculo já existe', async () => {
    roleRepoMock.findByIdAndCompanyId.mockResolvedValue(role);
    permissionRepoMock.findById.mockResolvedValue({
      id: permissionId,
      code: 'REGISTER_ENTRY',
      description: null,
    });
    rolePermissionRepoMock.exists.mockResolvedValue(true);

    await expect(
      useCase.execute(
        actor,
        new AssociatePermissionInputDto(role.id, permissionId),
      ),
    ).rejects.toThrow(ConflictException);
    expect(rolePermissionRepoMock.associate).not.toHaveBeenCalled();
  });
});
