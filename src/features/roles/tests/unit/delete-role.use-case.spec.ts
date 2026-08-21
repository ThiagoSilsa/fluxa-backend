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
import { GetRoleInputDto } from '../../application/dto/get-role-input.dto';

// Use case
import { DeleteRoleUseCase } from '../../application/use-cases/delete-role.use-case';

describe('DeleteRoleUseCase', () => {
  let useCase: DeleteRoleUseCase;

  const roleRepoMock = {
    findByIdAndCompanyId: jest.fn(),
    deleteByIdAndCompanyId: jest.fn(),
  } as jest.Mocked<
    Pick<RoleRepository, 'findByIdAndCompanyId' | 'deleteByIdAndCompanyId'>
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
        DeleteRoleUseCase,
        { provide: ROLE_REPOSITORY, useValue: roleRepoMock },
      ],
    }).compile();
    useCase = module.get(DeleteRoleUseCase);
  });

  it('exclui fisicamente o cargo (em cascata no repositório)', async () => {
    roleRepoMock.findByIdAndCompanyId.mockResolvedValue(role);
    roleRepoMock.deleteByIdAndCompanyId.mockResolvedValue(role);

    await expect(
      useCase.execute(actor, new GetRoleInputDto(role.id)),
    ).resolves.toBeUndefined();

    expect(roleRepoMock.deleteByIdAndCompanyId).toHaveBeenCalledWith(
      role.id,
      actor.companyId,
    );
  });

  it('lança NotFoundException quando o cargo não existe na empresa', async () => {
    roleRepoMock.findByIdAndCompanyId.mockResolvedValue(null);

    await expect(
      useCase.execute(actor, new GetRoleInputDto(role.id)),
    ).rejects.toThrow(NotFoundException);
    expect(roleRepoMock.deleteByIdAndCompanyId).not.toHaveBeenCalled();
  });

  it('lança NotFoundException quando o cargo some entre a checagem e a exclusão', async () => {
    roleRepoMock.findByIdAndCompanyId.mockResolvedValue(role);
    roleRepoMock.deleteByIdAndCompanyId.mockResolvedValue(null);

    await expect(
      useCase.execute(actor, new GetRoleInputDto(role.id)),
    ).rejects.toThrow(NotFoundException);
  });

  it('lança BadRequestException para cargo is_admin (imutável — ADR 0004)', async () => {
    roleRepoMock.findByIdAndCompanyId.mockResolvedValue({
      ...role,
      isAdmin: true,
    });

    await expect(
      useCase.execute(actor, new GetRoleInputDto(role.id)),
    ).rejects.toThrow(BadRequestException);
    expect(roleRepoMock.deleteByIdAndCompanyId).not.toHaveBeenCalled();
  });
});
