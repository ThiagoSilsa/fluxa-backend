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
import type { RolePermissionRepository } from '../../domain/repositories/role-permission.repository';
import type { RoleRepository } from '../../domain/repositories/role.repository';

// Repository
import { ROLE_PERMISSION_REPOSITORY } from '../../domain/repositories/role-permission.repository';
import { ROLE_REPOSITORY } from '../../domain/repositories/role.repository';

// DTO
import { RemovePermissionInputDto } from '../../application/dto/remove-permission-input.dto';

// Use case
import { RemovePermissionFromRoleUseCase } from '../../application/use-cases/remove-permission-from-role.use-case';

describe('RemovePermissionFromRoleUseCase', () => {
  let useCase: RemovePermissionFromRoleUseCase;

  const roleRepoMock = {
    findByIdAndCompanyId: jest.fn(),
  } as jest.Mocked<Pick<RoleRepository, 'findByIdAndCompanyId'>>;

  const rolePermissionRepoMock = {
    remove: jest.fn(),
  } as jest.Mocked<Pick<RolePermissionRepository, 'remove'>>;

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
        RemovePermissionFromRoleUseCase,
        { provide: ROLE_REPOSITORY, useValue: roleRepoMock },
        {
          provide: ROLE_PERMISSION_REPOSITORY,
          useValue: rolePermissionRepoMock,
        },
      ],
    }).compile();
    useCase = module.get(RemovePermissionFromRoleUseCase);
  });

  it('remove o vínculo da empresa', async () => {
    roleRepoMock.findByIdAndCompanyId.mockResolvedValue(role);
    rolePermissionRepoMock.remove.mockResolvedValue(true);

    await expect(
      useCase.execute(
        actor,
        new RemovePermissionInputDto(role.id, permissionId),
      ),
    ).resolves.toBeUndefined();

    expect(rolePermissionRepoMock.remove).toHaveBeenCalledWith(
      actor.companyId,
      role.id,
      permissionId,
    );
  });

  it('lança NotFoundException quando o cargo não existe na empresa', async () => {
    roleRepoMock.findByIdAndCompanyId.mockResolvedValue(null);

    await expect(
      useCase.execute(
        actor,
        new RemovePermissionInputDto(role.id, permissionId),
      ),
    ).rejects.toThrow(NotFoundException);
    expect(rolePermissionRepoMock.remove).not.toHaveBeenCalled();
  });

  it('lança NotFoundException quando o vínculo não existe', async () => {
    roleRepoMock.findByIdAndCompanyId.mockResolvedValue(role);
    rolePermissionRepoMock.remove.mockResolvedValue(false);

    await expect(
      useCase.execute(
        actor,
        new RemovePermissionInputDto(role.id, permissionId),
      ),
    ).rejects.toThrow(NotFoundException);
  });
});
