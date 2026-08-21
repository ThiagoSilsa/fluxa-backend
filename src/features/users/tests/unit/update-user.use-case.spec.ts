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
import type { UserEntity } from '../../domain/entities/user.entity';
import type { UserRoleWithRoleEntity } from '../../domain/entities/user-role.entity';
import type { UserRoleRepository } from '../../domain/repositories/user-role.repository';
import type { UserRepository } from '../../domain/repositories/user.repository';

// Repositories
import { AUTH_REPOSITORY } from '../../../auth/domain/repositories/auth.repository';
import { USER_COMPANY_REPOSITORY } from '../../../auth/domain/repositories/user-company.repository';
import { ROLE_REPOSITORY } from '../../../roles/domain/repositories/role.repository';
import { USER_REPOSITORY } from '../../domain/repositories/user.repository';
import { USER_ROLE_REPOSITORY } from '../../domain/repositories/user-role.repository';

// DTO
import { UpdateUserInputDto } from '../../application/dto/update-user-input.dto';

// Use case
import { UpdateUserUseCase } from '../../application/use-cases/update-user.use-case';

describe('UpdateUserUseCase', () => {
  let useCase: UpdateUserUseCase;

  const userRepoMock = {
    findByEmail: jest.fn(),
    findByDocument: jest.fn(),
    updateById: jest.fn(),
  } as jest.Mocked<
    Pick<UserRepository, 'findByEmail' | 'findByDocument' | 'updateById'>
  >;

  const userCompanyRepoMock = {
    findByUserIdAndCompanyId: jest.fn(),
    updateById: jest.fn(),
  } as jest.Mocked<
    Pick<UserCompanyRepository, 'findByUserIdAndCompanyId' | 'updateById'>
  >;

  const authRepoMock = {
    findHasAdminRoleByUserIdAndCompanyId: jest.fn(),
    countAdminsByCompanyId: jest.fn(),
  } as jest.Mocked<
    Pick<
      AuthRepository,
      'findHasAdminRoleByUserIdAndCompanyId' | 'countAdminsByCompanyId'
    >
  >;

  const roleRepoMock = {
    findByIdAndCompanyId: jest.fn(),
  } as jest.Mocked<Pick<RoleRepository, 'findByIdAndCompanyId'>>;

  const userRoleRepoMock = {
    listByUserIdAndCompanyId: jest.fn(),
    remove: jest.fn(),
    create: jest.fn(),
  } as jest.Mocked<
    Pick<UserRoleRepository, 'listByUserIdAndCompanyId' | 'remove' | 'create'>
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
    phone: '11999999999',
    document: '12345678900',
    photoUrl: null,
    type: UserType.EMPLOYEE,
    isActive: true,
  };

  const anotherPerson: UserEntity = {
    id: '60000000-0000-0000-0000-000000000002',
    name: 'Outra',
    email: 'outra@somar.local',
    passwordHash: '$2b$10$hash',
    phone: null,
    document: '98765432100',
    photoUrl: null,
    lastLoginAt: null,
    createdAt: new Date('2026-08-15T00:00:00Z'),
    updatedAt: new Date('2026-08-15T00:00:00Z'),
  };

  const porteiroRole: RoleEntity = {
    id: '20000000-0000-0000-0000-000000000004',
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
    id: '20000000-0000-0000-0000-000000000001',
    name: 'Administração',
    isAdmin: true,
  };

  const porteiroRoleSummary: UserRoleWithRoleEntity = {
    userRoleId: '80000000-0000-0000-0000-000000000001',
    userId: link.userId,
    roleId: porteiroRole.id,
    roleName: 'Porteiro',
    roleIsAdmin: false,
    roleIsActive: true,
    createdAt: new Date('2026-08-15T00:00:00Z'),
  };

  const adminRoleSummary: UserRoleWithRoleEntity = {
    ...porteiroRoleSummary,
    userRoleId: '80000000-0000-0000-0000-000000000002',
    roleId: adminRole.id,
    roleName: 'Administração',
    roleIsAdmin: true,
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    authRepoMock.findHasAdminRoleByUserIdAndCompanyId.mockResolvedValue(false);
    authRepoMock.countAdminsByCompanyId.mockResolvedValue(2);
    userRepoMock.updateById.mockResolvedValue(null);
    userCompanyRepoMock.updateById.mockResolvedValue(null);
    userRoleRepoMock.listByUserIdAndCompanyId.mockResolvedValue([]);
    userRoleRepoMock.remove.mockResolvedValue(true);
    userRoleRepoMock.create.mockResolvedValue();

    const module = await Test.createTestingModule({
      providers: [
        UpdateUserUseCase,
        { provide: USER_REPOSITORY, useValue: userRepoMock },
        {
          provide: USER_COMPANY_REPOSITORY,
          useValue: userCompanyRepoMock,
        },
        { provide: AUTH_REPOSITORY, useValue: authRepoMock },
        { provide: ROLE_REPOSITORY, useValue: roleRepoMock },
        { provide: USER_ROLE_REPOSITORY, useValue: userRoleRepoMock },
      ],
    }).compile();
    useCase = module.get(UpdateUserUseCase);
  });

  it('atualiza dados da pessoa e devolve o usuário atualizado', async () => {
    userCompanyRepoMock.findByUserIdAndCompanyId
      .mockResolvedValueOnce(link)
      .mockResolvedValueOnce({ ...link, name: 'Maria Silva' });

    const result = await useCase.execute(
      adminActor,
      new UpdateUserInputDto(link.userId, 'Maria Silva'),
    );

    expect(userRepoMock.updateById).toHaveBeenCalledWith(link.userId, {
      name: 'Maria Silva',
    });
    expect(userCompanyRepoMock.updateById).not.toHaveBeenCalled();
    expect(result).toEqual(
      expect.objectContaining({ id: link.userId, name: 'Maria Silva' }),
    );
  });

  it('normaliza o e-mail antes de verificar conflito e atualizar', async () => {
    userCompanyRepoMock.findByUserIdAndCompanyId.mockResolvedValue(link);
    userRepoMock.findByEmail.mockResolvedValue(null);

    await useCase.execute(
      adminActor,
      new UpdateUserInputDto(link.userId, undefined, '  Maria@Somar.Local '),
    );

    expect(userRepoMock.findByEmail).toHaveBeenCalledWith('maria@somar.local');
    expect(userRepoMock.updateById).toHaveBeenCalledWith(link.userId, {
      email: 'maria@somar.local',
    });
  });

  it('permite manter o próprio e-mail (sem conflito consigo mesmo)', async () => {
    userCompanyRepoMock.findByUserIdAndCompanyId.mockResolvedValue(link);
    userRepoMock.findByEmail.mockResolvedValue({
      ...anotherPerson,
      id: link.userId,
      email: 'maria@somar.local',
    });

    await expect(
      useCase.execute(
        adminActor,
        new UpdateUserInputDto(link.userId, undefined, 'maria@somar.local'),
      ),
    ).resolves.toBeDefined();
  });

  it('rejeita e-mail de outra pessoa (409)', async () => {
    userCompanyRepoMock.findByUserIdAndCompanyId.mockResolvedValue(link);
    userRepoMock.findByEmail.mockResolvedValue(anotherPerson);

    await expect(
      useCase.execute(
        adminActor,
        new UpdateUserInputDto(link.userId, undefined, 'outra@somar.local'),
      ),
    ).rejects.toThrow(ConflictException);
    expect(userRepoMock.updateById).not.toHaveBeenCalled();
  });

  it('rejeita documento de outra pessoa (409)', async () => {
    userCompanyRepoMock.findByUserIdAndCompanyId.mockResolvedValue(link);
    userRepoMock.findByDocument.mockResolvedValue(anotherPerson);

    await expect(
      useCase.execute(
        adminActor,
        new UpdateUserInputDto(
          link.userId,
          undefined,
          undefined,
          undefined,
          '98765432100',
        ),
      ),
    ).rejects.toThrow(ConflictException);
    expect(userRepoMock.updateById).not.toHaveBeenCalled();
  });

  it('atualiza dados do vínculo (type/is_active) na empresa da sessão', async () => {
    userCompanyRepoMock.findByUserIdAndCompanyId.mockResolvedValue(link);

    await useCase.execute(
      adminActor,
      new UpdateUserInputDto(
        link.userId,
        undefined,
        undefined,
        undefined,
        undefined,
        UserType.VISITOR,
        false,
      ),
    );

    expect(userCompanyRepoMock.updateById).toHaveBeenCalledWith(link.linkId, {
      type: UserType.VISITOR,
      isActive: false,
    });
  });

  it('rejeita edição de usuário admin por não-admin (403)', async () => {
    userCompanyRepoMock.findByUserIdAndCompanyId.mockResolvedValue(link);
    authRepoMock.findHasAdminRoleByUserIdAndCompanyId.mockResolvedValue(true);

    await expect(
      useCase.execute(
        nonAdminActor,
        new UpdateUserInputDto(link.userId, 'Maria'),
      ),
    ).rejects.toThrow(ForbiddenException);
    expect(userRepoMock.updateById).not.toHaveBeenCalled();
  });

  it('rejeita desativar o último admin ativo (409)', async () => {
    userCompanyRepoMock.findByUserIdAndCompanyId.mockResolvedValue(link);
    authRepoMock.findHasAdminRoleByUserIdAndCompanyId.mockResolvedValue(true);
    authRepoMock.countAdminsByCompanyId.mockResolvedValue(1);

    await expect(
      useCase.execute(
        adminActor,
        new UpdateUserInputDto(
          link.userId,
          undefined,
          undefined,
          undefined,
          undefined,
          undefined,
          false,
        ),
      ),
    ).rejects.toThrow(ConflictException);
    expect(userCompanyRepoMock.updateById).not.toHaveBeenCalled();
  });

  it('lança NotFound quando o usuário não tem vínculo com a empresa', async () => {
    userCompanyRepoMock.findByUserIdAndCompanyId.mockResolvedValue(null);

    await expect(
      useCase.execute(adminActor, new UpdateUserInputDto(link.userId, 'X')),
    ).rejects.toThrow(NotFoundException);
  });

  // -----------------------------------------------------------------------
  // roleId — troca do cargo único (ADR 0005 §5)
  // -----------------------------------------------------------------------

  it('troca o cargo único (remove o atual e cria o novo)', async () => {
    userCompanyRepoMock.findByUserIdAndCompanyId.mockResolvedValue(link);
    userRoleRepoMock.listByUserIdAndCompanyId
      .mockResolvedValueOnce([porteiroRoleSummary])
      .mockResolvedValueOnce([adminRoleSummary]);
    roleRepoMock.findByIdAndCompanyId.mockResolvedValue(adminRole);

    const result = await useCase.execute(
      adminActor,
      new UpdateUserInputDto(
        link.userId,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        adminRole.id,
      ),
    );

    expect(roleRepoMock.findByIdAndCompanyId).toHaveBeenCalledWith(
      adminRole.id,
      adminActor.companyId,
    );
    expect(userRoleRepoMock.remove).toHaveBeenCalledWith(
      link.userId,
      porteiroRole.id,
      adminActor.companyId,
    );
    expect(userRoleRepoMock.create).toHaveBeenCalledWith(
      link.userId,
      adminRole.id,
      adminActor.companyId,
    );
    expect(result.role).toEqual({
      userRoleId: adminRoleSummary.userRoleId,
      roleId: adminRole.id,
      roleName: 'Administração',
      isAdmin: true,
    });
  });

  it('remove o cargo quando roleId é null (opção "sem cargo")', async () => {
    userCompanyRepoMock.findByUserIdAndCompanyId.mockResolvedValue(link);
    userRoleRepoMock.listByUserIdAndCompanyId
      .mockResolvedValueOnce([porteiroRoleSummary])
      .mockResolvedValueOnce([]);

    const result = await useCase.execute(
      adminActor,
      new UpdateUserInputDto(
        link.userId,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        null,
      ),
    );

    expect(userRoleRepoMock.remove).toHaveBeenCalledWith(
      link.userId,
      porteiroRole.id,
      adminActor.companyId,
    );
    expect(userRoleRepoMock.create).not.toHaveBeenCalled();
    expect(result.role).toBeNull();
  });

  it('não altera o cargo quando já é o mesmo', async () => {
    userCompanyRepoMock.findByUserIdAndCompanyId.mockResolvedValue(link);
    userRoleRepoMock.listByUserIdAndCompanyId.mockResolvedValue([
      porteiroRoleSummary,
    ]);

    await useCase.execute(
      adminActor,
      new UpdateUserInputDto(
        link.userId,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        porteiroRole.id,
      ),
    );

    expect(userRoleRepoMock.remove).not.toHaveBeenCalled();
    expect(userRoleRepoMock.create).not.toHaveBeenCalled();
  });

  it('rejeita cargo fora da empresa da sessão (404)', async () => {
    userCompanyRepoMock.findByUserIdAndCompanyId.mockResolvedValue(link);
    userRoleRepoMock.listByUserIdAndCompanyId.mockResolvedValue([]);
    roleRepoMock.findByIdAndCompanyId.mockResolvedValue(null);

    await expect(
      useCase.execute(
        adminActor,
        new UpdateUserInputDto(
          link.userId,
          undefined,
          undefined,
          undefined,
          undefined,
          undefined,
          undefined,
          adminRole.id,
        ),
      ),
    ).rejects.toThrow(NotFoundException);
    expect(userRoleRepoMock.create).not.toHaveBeenCalled();
  });

  it('rejeita atribuir cargo is_admin por ator não-admin (403)', async () => {
    userCompanyRepoMock.findByUserIdAndCompanyId.mockResolvedValue(link);
    userRoleRepoMock.listByUserIdAndCompanyId.mockResolvedValue([
      porteiroRoleSummary,
    ]);
    roleRepoMock.findByIdAndCompanyId.mockResolvedValue(adminRole);

    await expect(
      useCase.execute(
        nonAdminActor,
        new UpdateUserInputDto(
          link.userId,
          undefined,
          undefined,
          undefined,
          undefined,
          undefined,
          undefined,
          adminRole.id,
        ),
      ),
    ).rejects.toThrow(ForbiddenException);
    expect(userRoleRepoMock.remove).not.toHaveBeenCalled();
    expect(userRoleRepoMock.create).not.toHaveBeenCalled();
  });

  it('rejeita remover is_admin do último admin ativo (409)', async () => {
    userCompanyRepoMock.findByUserIdAndCompanyId.mockResolvedValue(link);
    authRepoMock.findHasAdminRoleByUserIdAndCompanyId.mockResolvedValue(true);
    authRepoMock.countAdminsByCompanyId.mockResolvedValue(1);
    userRoleRepoMock.listByUserIdAndCompanyId.mockResolvedValue([
      adminRoleSummary,
    ]);

    await expect(
      useCase.execute(
        adminActor,
        new UpdateUserInputDto(
          link.userId,
          undefined,
          undefined,
          undefined,
          undefined,
          undefined,
          undefined,
          null,
        ),
      ),
    ).rejects.toThrow(ConflictException);
    expect(userRoleRepoMock.remove).not.toHaveBeenCalled();
  });
});
