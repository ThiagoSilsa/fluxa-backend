// NestJS
import { NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';

// Shared
import { PermissionCode } from '../../../../shared/constants/access-control.constant';

// Constants
import { UserType } from '../../../auth/domain/constants/user-type.constant';

// Types
import type { AuthenticatedUserEntity } from '../../../auth/domain/entities/authenticated-user.entity';
import type { UserCompanyRepository } from '../../../auth/domain/repositories/user-company.repository';
import type { UserRoleRepository } from '../../domain/repositories/user-role.repository';

// Repositories
import { USER_COMPANY_REPOSITORY } from '../../../auth/domain/repositories/user-company.repository';
import { USER_ROLE_REPOSITORY } from '../../domain/repositories/user-role.repository';

// DTO
import { ListUserRolesInputDto } from '../../application/dto/list-user-roles-input.dto';

// Use case
import { ListUserRolesUseCase } from '../../application/use-cases/list-user-roles.use-case';

describe('ListUserRolesUseCase', () => {
  let useCase: ListUserRolesUseCase;

  const userCompanyRepoMock = {
    findByUserIdAndCompanyId: jest.fn(),
  } as jest.Mocked<Pick<UserCompanyRepository, 'findByUserIdAndCompanyId'>>;

  const userRoleRepoMock = {
    listByUserIdAndCompanyId: jest.fn(),
  } as jest.Mocked<Pick<UserRoleRepository, 'listByUserIdAndCompanyId'>>;

  const actor: AuthenticatedUserEntity = {
    id: '30000000-0000-0000-0000-000000000001',
    companyId: '10000000-0000-0000-0000-000000000001',
    email: 'admin@somar.local',
    name: 'Administrador',
    type: UserType.EMPLOYEE,
    isAdmin: true,
    roleCodes: ['Administração'],
    permissions: [PermissionCode.MANAGE_USERS],
  };

  const link = {
    linkId: '70000000-0000-0000-0000-000000000001',
    userId: '60000000-0000-0000-0000-000000000001',
    name: 'Maria',
    email: 'maria@somar.local',
    phone: null,
    document: null,
    photoUrl: null,
    type: UserType.EMPLOYEE,
    isActive: true,
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module = await Test.createTestingModule({
      providers: [
        ListUserRolesUseCase,
        {
          provide: USER_COMPANY_REPOSITORY,
          useValue: userCompanyRepoMock,
        },
        { provide: USER_ROLE_REPOSITORY, useValue: userRoleRepoMock },
      ],
    }).compile();
    useCase = module.get(ListUserRolesUseCase);
  });

  it('lista os cargos do usuário na empresa da sessão', async () => {
    userCompanyRepoMock.findByUserIdAndCompanyId.mockResolvedValue(link);
    userRoleRepoMock.listByUserIdAndCompanyId.mockResolvedValue([
      {
        userRoleId: '80000000-0000-0000-0000-000000000001',
        userId: link.userId,
        roleId: '40000000-0000-0000-0000-000000000004',
        roleName: 'Porteiro',
        roleIsAdmin: false,
        roleIsActive: true,
        createdAt: new Date('2026-08-15T00:00:00Z'),
      },
      {
        userRoleId: '80000000-0000-0000-0000-000000000002',
        userId: link.userId,
        roleId: '40000000-0000-0000-0000-000000000002',
        roleName: 'Segurança',
        roleIsAdmin: false,
        roleIsActive: true,
        createdAt: new Date('2026-08-15T00:00:00Z'),
      },
    ]);

    const result = await useCase.execute(
      actor,
      new ListUserRolesInputDto(link.userId),
    );

    expect(userRoleRepoMock.listByUserIdAndCompanyId).toHaveBeenCalledWith(
      link.userId,
      actor.companyId,
    );
    expect(result).toEqual({
      userId: link.userId,
      roles: [
        {
          userRoleId: '80000000-0000-0000-0000-000000000001',
          roleId: '40000000-0000-0000-0000-000000000004',
          roleName: 'Porteiro',
          isAdmin: false,
          isActive: true,
        },
        {
          userRoleId: '80000000-0000-0000-0000-000000000002',
          roleId: '40000000-0000-0000-0000-000000000002',
          roleName: 'Segurança',
          isAdmin: false,
          isActive: true,
        },
      ],
    });
  });

  it('lança NotFound quando o usuário não tem vínculo com a empresa', async () => {
    userCompanyRepoMock.findByUserIdAndCompanyId.mockResolvedValue(null);

    await expect(
      useCase.execute(actor, new ListUserRolesInputDto(link.userId)),
    ).rejects.toThrow(NotFoundException);
    expect(userRoleRepoMock.listByUserIdAndCompanyId).not.toHaveBeenCalled();
  });
});
