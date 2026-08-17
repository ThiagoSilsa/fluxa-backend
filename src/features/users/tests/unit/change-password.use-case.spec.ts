// NestJS
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';

// Shared
import { PermissionCode } from '../../../../shared/constants/access-control.constant';
import { PasswordHashUseCase } from '../../../../shared/security/password-hash.use-case';

// Constants
import { UserType } from '../../../auth/domain/constants/user-type.constant';

// Types
import type { AuthRepository } from '../../../auth/domain/repositories/auth.repository';
import type { AuthenticatedUserEntity } from '../../../auth/domain/entities/authenticated-user.entity';
import type { UserCompanyRepository } from '../../../auth/domain/repositories/user-company.repository';
import type { UserRepository } from '../../domain/repositories/user.repository';

// Repositories
import { AUTH_REPOSITORY } from '../../../auth/domain/repositories/auth.repository';
import { USER_COMPANY_REPOSITORY } from '../../../auth/domain/repositories/user-company.repository';
import { USER_REPOSITORY } from '../../domain/repositories/user.repository';

// DTO
import { ChangePasswordInputDto } from '../../application/dto/change-password-input.dto';

// Use case
import { ChangePasswordUseCase } from '../../application/use-cases/change-password.use-case';

describe('ChangePasswordUseCase', () => {
  let useCase: ChangePasswordUseCase;

  const userRepoMock = {
    updatePasswordById: jest.fn(),
  } as jest.Mocked<Pick<UserRepository, 'updatePasswordById'>>;

  const userCompanyRepoMock = {
    findByUserIdAndCompanyId: jest.fn(),
  } as jest.Mocked<Pick<UserCompanyRepository, 'findByUserIdAndCompanyId'>>;

  const authRepoMock = {
    findHasAdminRoleByUserIdAndCompanyId: jest.fn(),
  } as jest.Mocked<
    Pick<AuthRepository, 'findHasAdminRoleByUserIdAndCompanyId'>
  >;

  const passwordHashMock = {
    execute: jest.fn(),
  } as jest.Mocked<Pick<PasswordHashUseCase, 'execute'>>;

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

  const activeLink = {
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
    passwordHashMock.execute.mockReturnValue('$2b$10$hashed');
    userRepoMock.updatePasswordById.mockResolvedValue(undefined);
    authRepoMock.findHasAdminRoleByUserIdAndCompanyId.mockResolvedValue(false);

    const module = await Test.createTestingModule({
      providers: [
        ChangePasswordUseCase,
        { provide: USER_REPOSITORY, useValue: userRepoMock },
        {
          provide: USER_COMPANY_REPOSITORY,
          useValue: userCompanyRepoMock,
        },
        { provide: AUTH_REPOSITORY, useValue: authRepoMock },
        { provide: PasswordHashUseCase, useValue: passwordHashMock },
      ],
    }).compile();
    useCase = module.get(ChangePasswordUseCase);
  });

  it('troca a senha (hash bcrypt) do usuário com vínculo ativo', async () => {
    userCompanyRepoMock.findByUserIdAndCompanyId.mockResolvedValue(activeLink);

    await useCase.execute(
      adminActor,
      new ChangePasswordInputDto(activeLink.userId, 'nova-senha'),
    );

    expect(passwordHashMock.execute).toHaveBeenCalledWith('nova-senha');
    expect(userRepoMock.updatePasswordById).toHaveBeenCalledWith(
      activeLink.userId,
      '$2b$10$hashed',
    );
  });

  it('lança NotFound quando o usuário não tem vínculo com a empresa', async () => {
    userCompanyRepoMock.findByUserIdAndCompanyId.mockResolvedValue(null);

    await expect(
      useCase.execute(
        adminActor,
        new ChangePasswordInputDto(activeLink.userId, 'nova-senha'),
      ),
    ).rejects.toThrow(NotFoundException);
    expect(userRepoMock.updatePasswordById).not.toHaveBeenCalled();
  });

  it('lança NotFound quando o vínculo está inativo', async () => {
    userCompanyRepoMock.findByUserIdAndCompanyId.mockResolvedValue({
      ...activeLink,
      isActive: false,
    });

    await expect(
      useCase.execute(
        adminActor,
        new ChangePasswordInputDto(activeLink.userId, 'nova-senha'),
      ),
    ).rejects.toThrow(NotFoundException);
    expect(userRepoMock.updatePasswordById).not.toHaveBeenCalled();
  });

  it('rejeita trocar a senha de um admin por não-admin (403)', async () => {
    userCompanyRepoMock.findByUserIdAndCompanyId.mockResolvedValue(activeLink);
    authRepoMock.findHasAdminRoleByUserIdAndCompanyId.mockResolvedValue(true);

    await expect(
      useCase.execute(
        nonAdminActor,
        new ChangePasswordInputDto(activeLink.userId, 'nova-senha'),
      ),
    ).rejects.toThrow(ForbiddenException);
    expect(userRepoMock.updatePasswordById).not.toHaveBeenCalled();
  });
});
