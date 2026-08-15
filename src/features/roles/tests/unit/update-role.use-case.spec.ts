// NestJS
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';

// Shared
import { PermissionCode } from '../../../../shared/constants/access-control.constant';

// Constants
import { UserType } from '../../../auth/domain/constants/user-type.constant';

// Types
import type { AuthenticatedUserEntity } from '../../../auth/domain/entities/authenticated-user.entity';
import type { RoleEntity } from '../../domain/entities/role.entity';
import type { RoleRepository } from '../../domain/repositories/role.repository';

// Repository
import { ROLE_REPOSITORY } from '../../domain/repositories/role.repository';

// DTO
import { UpdateRoleInputDto } from '../../application/dto/update-role-input.dto';

// Use case
import { UpdateRoleUseCase } from '../../application/use-cases/update-role.use-case';

describe('UpdateRoleUseCase', () => {
  let useCase: UpdateRoleUseCase;

  const roleRepoMock = {
    findByIdAndCompanyId: jest.fn(),
    updateByIdAndCompanyId: jest.fn(),
  } as jest.Mocked<
    Pick<RoleRepository, 'findByIdAndCompanyId' | 'updateByIdAndCompanyId'>
  >;

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
        UpdateRoleUseCase,
        { provide: ROLE_REPOSITORY, useValue: roleRepoMock },
      ],
    }).compile();
    useCase = module.get(UpdateRoleUseCase);
  });

  it('atualiza nome/descrição do cargo da empresa', async () => {
    roleRepoMock.findByIdAndCompanyId.mockResolvedValue(role);
    roleRepoMock.updateByIdAndCompanyId.mockResolvedValue({
      ...role,
      name: 'Porteiro Sênior',
      description: 'Opera a portaria',
    });

    const result = await useCase.execute(
      actor,
      new UpdateRoleInputDto(role.id, 'Porteiro Sênior', 'Opera a portaria'),
    );

    expect(roleRepoMock.updateByIdAndCompanyId).toHaveBeenCalledWith(
      role.id,
      actor.companyId,
      { name: 'Porteiro Sênior', description: 'Opera a portaria' },
    );
    expect(result).toEqual({
      id: role.id,
      name: 'Porteiro Sênior',
      description: 'Opera a portaria',
      isAdmin: false,
      isActive: true,
    });
  });

  it('lança NotFoundException quando o cargo não existe na empresa', async () => {
    roleRepoMock.findByIdAndCompanyId.mockResolvedValue(null);

    await expect(
      useCase.execute(actor, new UpdateRoleInputDto(role.id, 'Novo')),
    ).rejects.toThrow(NotFoundException);
    expect(roleRepoMock.updateByIdAndCompanyId).not.toHaveBeenCalled();
  });

  it('lança BadRequestException para cargo is_admin (imutável — ADR 0004)', async () => {
    roleRepoMock.findByIdAndCompanyId.mockResolvedValue({
      ...role,
      isAdmin: true,
    });

    await expect(
      useCase.execute(actor, new UpdateRoleInputDto(role.id, 'Admin')),
    ).rejects.toThrow(BadRequestException);
    expect(roleRepoMock.updateByIdAndCompanyId).not.toHaveBeenCalled();
  });
});
