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
import type { RoleRepository } from '../../domain/repositories/role.repository';

// Repository
import { ROLE_REPOSITORY } from '../../domain/repositories/role.repository';

// DTO
import { GetRoleInputDto } from '../../application/dto/get-role-input.dto';

// Use case
import { GetRoleUseCase } from '../../application/use-cases/get-role.use-case';

describe('GetRoleUseCase', () => {
  let useCase: GetRoleUseCase;

  const roleRepoMock = {
    findByIdAndCompanyId: jest.fn(),
  } as jest.Mocked<Pick<RoleRepository, 'findByIdAndCompanyId'>>;

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
        GetRoleUseCase,
        { provide: ROLE_REPOSITORY, useValue: roleRepoMock },
      ],
    }).compile();
    useCase = module.get(GetRoleUseCase);
  });

  it('devolve o cargo da empresa da sessão', async () => {
    roleRepoMock.findByIdAndCompanyId.mockResolvedValue(role);

    const result = await useCase.execute(actor, new GetRoleInputDto(role.id));

    expect(roleRepoMock.findByIdAndCompanyId).toHaveBeenCalledWith(
      role.id,
      actor.companyId,
    );
    expect(result).toEqual({
      id: role.id,
      name: 'Porteiro',
      description: null,
      isAdmin: false,
      isActive: true,
    });
  });

  it('lança NotFoundException quando o cargo não existe na empresa (cross-tenant não é revelado)', async () => {
    roleRepoMock.findByIdAndCompanyId.mockResolvedValue(null);

    await expect(
      useCase.execute(actor, new GetRoleInputDto(role.id)),
    ).rejects.toThrow(NotFoundException);
  });
});
