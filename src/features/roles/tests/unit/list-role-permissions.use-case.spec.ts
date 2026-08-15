// NestJS
import { NotFoundException } from '@nestjs/common';
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
import { ListRolePermissionsInputDto } from '../../application/dto/list-role-permissions-input.dto';

// Use case
import { ListRolePermissionsUseCase } from '../../application/use-cases/list-role-permissions.use-case';

describe('ListRolePermissionsUseCase', () => {
  let useCase: ListRolePermissionsUseCase;

  const roleRepoMock = {
    findByIdAndCompanyId: jest.fn(),
  } as jest.Mocked<Pick<RoleRepository, 'findByIdAndCompanyId'>>;

  const rolePermissionRepoMock = {
    listByRoleIdAndCompanyId: jest.fn(),
  } as jest.Mocked<Pick<RolePermissionRepository, 'listByRoleIdAndCompanyId'>>;

  const permissionRepoMock = {
    listAll: jest.fn(),
  } as jest.Mocked<Pick<PermissionRepository, 'listAll'>>;

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

  beforeEach(async () => {
    jest.clearAllMocks();
    const module = await Test.createTestingModule({
      providers: [
        ListRolePermissionsUseCase,
        { provide: ROLE_REPOSITORY, useValue: roleRepoMock },
        {
          provide: ROLE_PERMISSION_REPOSITORY,
          useValue: rolePermissionRepoMock,
        },
        { provide: PERMISSION_REPOSITORY, useValue: permissionRepoMock },
      ],
    }).compile();
    useCase = module.get(ListRolePermissionsUseCase);
  });

  it('devolve as permissões vinculadas e o catálogo disponível', async () => {
    roleRepoMock.findByIdAndCompanyId.mockResolvedValue(role);
    rolePermissionRepoMock.listByRoleIdAndCompanyId.mockResolvedValue([
      {
        id: 'rp1',
        companyId: actor.companyId,
        roleId: role.id,
        permissionId: 'p1',
        permission: { id: 'p1', code: 'REGISTER_ENTRY', description: null },
      },
    ]);
    permissionRepoMock.listAll.mockResolvedValue([
      { id: 'p1', code: 'REGISTER_ENTRY', description: null },
      { id: 'p2', code: 'MANAGE_ROLES', description: 'Gerencia cargos' },
    ]);

    const result = await useCase.execute(
      actor,
      new ListRolePermissionsInputDto(role.id),
    );

    expect(
      rolePermissionRepoMock.listByRoleIdAndCompanyId,
    ).toHaveBeenCalledWith(role.id, actor.companyId);
    expect(result).toEqual({
      roleId: role.id,
      permissions: [{ id: 'p1', code: 'REGISTER_ENTRY', description: null }],
      available: [
        { id: 'p1', code: 'REGISTER_ENTRY', description: null },
        { id: 'p2', code: 'MANAGE_ROLES', description: 'Gerencia cargos' },
      ],
    });
  });

  it('lança NotFoundException quando o cargo não existe na empresa', async () => {
    roleRepoMock.findByIdAndCompanyId.mockResolvedValue(null);

    await expect(
      useCase.execute(actor, new ListRolePermissionsInputDto(role.id)),
    ).rejects.toThrow(NotFoundException);
    expect(
      rolePermissionRepoMock.listByRoleIdAndCompanyId,
    ).not.toHaveBeenCalled();
  });
});
