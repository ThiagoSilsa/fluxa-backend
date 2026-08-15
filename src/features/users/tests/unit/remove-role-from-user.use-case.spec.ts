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
import { RemoveRoleInputDto } from '../../application/dto/remove-role-input.dto';

// Use case
import { RemoveRoleFromUserUseCase } from '../../application/use-cases/remove-role-from-user.use-case';

describe('RemoveRoleFromUserUseCase', () => {
  let useCase: RemoveRoleFromUserUseCase;

  const userCompanyRepoMock = {
    findByUserIdAndCompanyId: jest.fn(),
  } as jest.Mocked<Pick<UserCompanyRepository, 'findByUserIdAndCompanyId'>>;

  const roleRepoMock = {
    findByIdAndCompanyId: jest.fn(),
  } as jest.Mocked<Pick<RoleRepository, 'findByIdAndCompanyId'>>;

  const userRoleRepoMock = {
    exists: jest.fn(),
    remove: jest.fn(),
  } as jest.Mocked<Pick<UserRoleRepository, 'exists' | 'remove'>>;

  const authRepoMock = {
    findHasAdminRoleByUserIdAndCompanyId: jest.fn(),
    countAdminsByCompanyId: jest.fn(),
  } as jest.Mocked<
    Pick<
      AuthRepository,
      'findHasAdminRoleByUserIdAndCompanyId' | 'countAdminsByCompanyId'
    >
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
    observation: null,
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
    authRepoMock.countAdminsByCompanyId.mockResolvedValue(2);
    userRoleRepoMock.exists.mockResolvedValue(true);
    userRoleRepoMock.remove.mockResolvedValue(true);

    const module = await Test.createTestingModule({
      providers: [
        RemoveRoleFromUserUseCase,
        {
          provide: USER_COMPANY_REPOSITORY,
          useValue: userCompanyRepoMock,
        },
        { provide: ROLE_REPOSITORY, useValue: roleRepoMock },
        { provide: USER_ROLE_REPOSITORY, useValue: userRoleRepoMock },
        { provide: AUTH_REPOSITORY, useValue: authRepoMock },
      ],
    }).compile();
    useCase = module.get(RemoveRoleFromUserUseCase);
  });

  it('remove o cargo do usuário na empresa', async () => {
    userCompanyRepoMock.findByUserIdAndCompanyId.mockResolvedValue(link);
    roleRepoMock.findByIdAndCompanyId.mockResolvedValue(porteiroRole);

    await useCase.execute(
      adminActor,
      new RemoveRoleInputDto(link.userId, porteiroRole.id),
    );

    expect(userRoleRepoMock.remove).toHaveBeenCalledWith(
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
        new RemoveRoleInputDto(link.userId, porteiroRole.id),
      ),
    ).rejects.toThrow(NotFoundException);
    expect(userRoleRepoMock.remove).not.toHaveBeenCalled();
  });

  it('lança NotFound quando o cargo não pertence à empresa', async () => {
    userCompanyRepoMock.findByUserIdAndCompanyId.mockResolvedValue(link);
    roleRepoMock.findByIdAndCompanyId.mockResolvedValue(null);

    await expect(
      useCase.execute(
        adminActor,
        new RemoveRoleInputDto(link.userId, porteiroRole.id),
      ),
    ).rejects.toThrow(NotFoundException);
    expect(userRoleRepoMock.remove).not.toHaveBeenCalled();
  });

  it('lança NotFound quando o usuário não possui o cargo', async () => {
    userCompanyRepoMock.findByUserIdAndCompanyId.mockResolvedValue(link);
    roleRepoMock.findByIdAndCompanyId.mockResolvedValue(porteiroRole);
    userRoleRepoMock.exists.mockResolvedValue(false);

    await expect(
      useCase.execute(
        adminActor,
        new RemoveRoleInputDto(link.userId, porteiroRole.id),
      ),
    ).rejects.toThrow(NotFoundException);
    expect(userRoleRepoMock.remove).not.toHaveBeenCalled();
  });

  it('rejeita remover cargo is_admin por não-admin (403)', async () => {
    userCompanyRepoMock.findByUserIdAndCompanyId.mockResolvedValue(link);
    roleRepoMock.findByIdAndCompanyId.mockResolvedValue(adminRole);

    await expect(
      useCase.execute(
        nonAdminActor,
        new RemoveRoleInputDto(link.userId, adminRole.id),
      ),
    ).rejects.toThrow(ForbiddenException);
    expect(userRoleRepoMock.remove).not.toHaveBeenCalled();
  });

  it('rejeita gerenciar cargos de um usuário admin por não-admin (403)', async () => {
    userCompanyRepoMock.findByUserIdAndCompanyId.mockResolvedValue(link);
    roleRepoMock.findByIdAndCompanyId.mockResolvedValue(porteiroRole);
    authRepoMock.findHasAdminRoleByUserIdAndCompanyId.mockResolvedValue(true);

    await expect(
      useCase.execute(
        nonAdminActor,
        new RemoveRoleInputDto(link.userId, porteiroRole.id),
      ),
    ).rejects.toThrow(ForbiddenException);
    expect(userRoleRepoMock.remove).not.toHaveBeenCalled();
  });

  it('rejeita remover o cargo is_admin do último admin ativo (409)', async () => {
    userCompanyRepoMock.findByUserIdAndCompanyId.mockResolvedValue(link);
    roleRepoMock.findByIdAndCompanyId.mockResolvedValue(adminRole);
    authRepoMock.findHasAdminRoleByUserIdAndCompanyId.mockResolvedValue(true);
    authRepoMock.countAdminsByCompanyId.mockResolvedValue(1);

    await expect(
      useCase.execute(
        adminActor,
        new RemoveRoleInputDto(link.userId, adminRole.id),
      ),
    ).rejects.toThrow(ConflictException);
    expect(userRoleRepoMock.remove).not.toHaveBeenCalled();
  });
});
