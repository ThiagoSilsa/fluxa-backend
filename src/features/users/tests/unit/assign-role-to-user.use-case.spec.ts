// NestJS
import {
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';

// Shared
import { PermissionCode } from '../../../../shared/constants/access-control.constant';

// Constants
import { UserType } from '../../../auth/domain/constants/user-type.constant';

// Types
import type { AuthRepository } from '../../../auth/domain/repositories/auth.repository';
import type { AuthenticatedUserEntity } from '../../../auth/domain/entities/authenticated-user.entity';
import type { UserCompanyRepository } from '../../../auth/domain/repositories/user-company.repository';
import type { RoleEntity } from '../../../roles/domain/entities/role.entity';
import type { RoleRepository } from '../../../roles/domain/repositories/role.repository';
import type { UserRoleRepository } from '../../domain/repositories/user-role.repository';

// Repositories
import { AUTH_REPOSITORY } from '../../../auth/domain/repositories/auth.repository';
import { USER_COMPANY_REPOSITORY } from '../../../auth/domain/repositories/user-company.repository';
import { ROLE_REPOSITORY } from '../../../roles/domain/repositories/role.repository';
import { USER_ROLE_REPOSITORY } from '../../domain/repositories/user-role.repository';

// DTO
import { AssignRoleInputDto } from '../../application/dto/assign-role-input.dto';

// Use case
import { AssignRoleToUserUseCase } from '../../application/use-cases/assign-role-to-user.use-case';

describe('AssignRoleToUserUseCase', () => {
  let useCase: AssignRoleToUserUseCase;

  const userCompanyRepoMock = {
    findByUserIdAndCompanyId: jest.fn(),
  } as jest.Mocked<Pick<UserCompanyRepository, 'findByUserIdAndCompanyId'>>;

  const roleRepoMock = {
    findByIdAndCompanyId: jest.fn(),
  } as jest.Mocked<Pick<RoleRepository, 'findByIdAndCompanyId'>>;

  const userRoleRepoMock = {
    listByUserIdAndCompanyId: jest.fn(),
    create: jest.fn(),
  } as jest.Mocked<
    Pick<UserRoleRepository, 'listByUserIdAndCompanyId' | 'create'>
  >;

  const authRepoMock = {
    findHasAdminRoleByUserIdAndCompanyId: jest.fn(),
  } as jest.Mocked<
    Pick<AuthRepository, 'findHasAdminRoleByUserIdAndCompanyId'>
  >;

  const adminActor: AuthenticatedUserEntity = {
    id: '30000000-0000-0000-0000-000000000001',
    companyId: '10000000-0000-0000-0000-000000000001',
    email: 'admin@somar.local',
    name: 'Administrador',
    type: UserType.EMPLOYEE,
    isAdmin: true,
    roleCodes: ['Administração'],
    permissions: [PermissionCode.MANAGE_USERS],
  };

  const nonAdminActor: AuthenticatedUserEntity = {
    ...adminActor,
    isAdmin: false,
    roleCodes: ['Gestor'],
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

  const porteiroRole: RoleEntity = {
    id: '40000000-0000-0000-0000-000000000004',
    companyId: adminActor.companyId,
    name: 'Porteiro',
    description: null,
    isAdmin: false,
    isActive: true,
    createdAt: new Date('2026-08-15T00:00:00Z'),
    updatedAt: new Date('2026-08-15T00:00:00Z'),
  };

  const adminRole: RoleEntity = {
    ...porteiroRole,
    id: '40000000-0000-0000-0000-000000000001',
    name: 'Administração',
    isAdmin: true,
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    authRepoMock.findHasAdminRoleByUserIdAndCompanyId.mockResolvedValue(false);
    userRoleRepoMock.listByUserIdAndCompanyId.mockResolvedValue([]);
    userRoleRepoMock.create.mockResolvedValue(undefined);

    const module = await Test.createTestingModule({
      providers: [
        AssignRoleToUserUseCase,
        {
          provide: USER_COMPANY_REPOSITORY,
          useValue: userCompanyRepoMock,
        },
        { provide: ROLE_REPOSITORY, useValue: roleRepoMock },
        { provide: USER_ROLE_REPOSITORY, useValue: userRoleRepoMock },
        { provide: AUTH_REPOSITORY, useValue: authRepoMock },
      ],
    }).compile();
    useCase = module.get(AssignRoleToUserUseCase);
  });

  it('atribui um cargo da empresa ao usuário', async () => {
    userCompanyRepoMock.findByUserIdAndCompanyId.mockResolvedValue(link);
    roleRepoMock.findByIdAndCompanyId.mockResolvedValue(porteiroRole);

    await useCase.execute(
      adminActor,
      new AssignRoleInputDto(link.userId, porteiroRole.id),
    );

    expect(userRoleRepoMock.create).toHaveBeenCalledWith(
      link.userId,
      porteiroRole.id,
      adminActor.companyId,
    );
  });

  it('lança NotFound quando o usuário não tem vínculo com a empresa', async () => {
    userCompanyRepoMock.findByUserIdAndCompanyId.mockResolvedValue(null);

    await expect(
      useCase.execute(
        adminActor,
        new AssignRoleInputDto(link.userId, porteiroRole.id),
      ),
    ).rejects.toThrow(NotFoundException);
    expect(userRoleRepoMock.create).not.toHaveBeenCalled();
  });

  it('lança NotFound quando o cargo não pertence à empresa', async () => {
    userCompanyRepoMock.findByUserIdAndCompanyId.mockResolvedValue(link);
    roleRepoMock.findByIdAndCompanyId.mockResolvedValue(null);

    await expect(
      useCase.execute(
        adminActor,
        new AssignRoleInputDto(link.userId, porteiroRole.id),
      ),
    ).rejects.toThrow(NotFoundException);
    expect(userRoleRepoMock.create).not.toHaveBeenCalled();
  });

  it('lança Conflict quando o usuário já possui um cargo na empresa', async () => {
    userCompanyRepoMock.findByUserIdAndCompanyId.mockResolvedValue(link);
    roleRepoMock.findByIdAndCompanyId.mockResolvedValue(porteiroRole);
    userRoleRepoMock.listByUserIdAndCompanyId.mockResolvedValue([
      {
        userRoleId: '80000000-0000-0000-0000-000000000001',
        userId: link.userId,
        roleId: porteiroRole.id,
        roleName: 'Porteiro',
        roleIsAdmin: false,
        roleIsActive: true,
        createdAt: new Date('2026-08-15T00:00:00Z'),
      },
    ]);

    await expect(
      useCase.execute(
        adminActor,
        new AssignRoleInputDto(link.userId, porteiroRole.id),
      ),
    ).rejects.toThrow(ConflictException);
    expect(userRoleRepoMock.create).not.toHaveBeenCalled();
  });

  it('rejeita atribuir cargo is_admin por não-admin (403)', async () => {
    userCompanyRepoMock.findByUserIdAndCompanyId.mockResolvedValue(link);
    roleRepoMock.findByIdAndCompanyId.mockResolvedValue(adminRole);

    await expect(
      useCase.execute(
        nonAdminActor,
        new AssignRoleInputDto(link.userId, adminRole.id),
      ),
    ).rejects.toThrow(ForbiddenException);
    expect(userRoleRepoMock.create).not.toHaveBeenCalled();
  });

  it('rejeita gerenciar cargos de um usuário admin por não-admin (403)', async () => {
    userCompanyRepoMock.findByUserIdAndCompanyId.mockResolvedValue(link);
    roleRepoMock.findByIdAndCompanyId.mockResolvedValue(porteiroRole);
    authRepoMock.findHasAdminRoleByUserIdAndCompanyId.mockResolvedValue(true);

    await expect(
      useCase.execute(
        nonAdminActor,
        new AssignRoleInputDto(link.userId, porteiroRole.id),
      ),
    ).rejects.toThrow(ForbiddenException);
    expect(userRoleRepoMock.create).not.toHaveBeenCalled();
  });

  it('permite que um admin atribua cargo is_admin', async () => {
    userCompanyRepoMock.findByUserIdAndCompanyId.mockResolvedValue(link);
    roleRepoMock.findByIdAndCompanyId.mockResolvedValue(adminRole);

    await useCase.execute(
      adminActor,
      new AssignRoleInputDto(link.userId, adminRole.id),
    );

    expect(userRoleRepoMock.create).toHaveBeenCalledWith(
      link.userId,
      adminRole.id,
      adminActor.companyId,
    );
  });
});
