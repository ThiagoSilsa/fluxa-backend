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
import type { AuthenticatedUserEntity } from '../../../auth/domain/entities/authenticated-user.entity';
import type { AuthRepository } from '../../../auth/domain/repositories/auth.repository';
import type { UserCompanyRepository } from '../../../auth/domain/repositories/user-company.repository';
import type { UserRepository } from '../../domain/repositories/user.repository';

// Repositories
import { AUTH_REPOSITORY } from '../../../auth/domain/repositories/auth.repository';
import { USER_COMPANY_REPOSITORY } from '../../../auth/domain/repositories/user-company.repository';
import { USER_REPOSITORY } from '../../domain/repositories/user.repository';

// DTO
import { GetUserInputDto } from '../../application/dto/get-user-input.dto';

// Use case
import { DeleteUserUseCase } from '../../application/use-cases/delete-user.use-case';

describe('DeleteUserUseCase', () => {
  let useCase: DeleteUserUseCase;

  const userCompanyRepoMock = {
    findByUserIdAndCompanyId: jest.fn(),
  } as jest.Mocked<Pick<UserCompanyRepository, 'findByUserIdAndCompanyId'>>;

  const authRepoMock = {
    findHasAdminRoleByUserIdAndCompanyId: jest.fn(),
    countAdminsByCompanyId: jest.fn(),
  } as jest.Mocked<
    Pick<
      AuthRepository,
      'findHasAdminRoleByUserIdAndCompanyId' | 'countAdminsByCompanyId'
    >
  >;

  const userRepoMock = {
    removeCompanyLink: jest.fn(),
  } as jest.Mocked<Pick<UserRepository, 'removeCompanyLink'>>;

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
    id: '30000000-0000-0000-0000-000000000002',
    email: 'gestor@somar.local',
    isAdmin: false,
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

  beforeEach(async () => {
    jest.clearAllMocks();
    const module = await Test.createTestingModule({
      providers: [
        DeleteUserUseCase,
        { provide: USER_REPOSITORY, useValue: userRepoMock },
        { provide: USER_COMPANY_REPOSITORY, useValue: userCompanyRepoMock },
        { provide: AUTH_REPOSITORY, useValue: authRepoMock },
      ],
    }).compile();
    useCase = module.get(DeleteUserUseCase);
  });

  it('exclui a participação (remove cargo, vínculo e, se última empresa, a pessoa)', async () => {
    userCompanyRepoMock.findByUserIdAndCompanyId.mockResolvedValue(link);
    authRepoMock.findHasAdminRoleByUserIdAndCompanyId.mockResolvedValue(false);
    userRepoMock.removeCompanyLink.mockResolvedValue(true);

    await expect(
      useCase.execute(adminActor, new GetUserInputDto(link.userId)),
    ).resolves.toBeUndefined();

    expect(userRepoMock.removeCompanyLink).toHaveBeenCalledWith(
      link.userId,
      adminActor.companyId,
      link.linkId,
    );
  });

  it('lança NotFoundException quando o usuário não tem vínculo com a empresa', async () => {
    userCompanyRepoMock.findByUserIdAndCompanyId.mockResolvedValue(null);

    await expect(
      useCase.execute(adminActor, new GetUserInputDto(link.userId)),
    ).rejects.toThrow(NotFoundException);
    expect(userRepoMock.removeCompanyLink).not.toHaveBeenCalled();
  });

  it('lança ForbiddenException ao excluir usuário admin por não-admin', async () => {
    userCompanyRepoMock.findByUserIdAndCompanyId.mockResolvedValue(link);
    authRepoMock.findHasAdminRoleByUserIdAndCompanyId.mockResolvedValue(true);

    await expect(
      useCase.execute(nonAdminActor, new GetUserInputDto(link.userId)),
    ).rejects.toThrow(ForbiddenException);
    expect(userRepoMock.removeCompanyLink).not.toHaveBeenCalled();
  });

  it('lança ConflictException ao excluir o último admin ativo', async () => {
    userCompanyRepoMock.findByUserIdAndCompanyId.mockResolvedValue(link);
    authRepoMock.findHasAdminRoleByUserIdAndCompanyId.mockResolvedValue(true);
    authRepoMock.countAdminsByCompanyId.mockResolvedValue(1);

    await expect(
      useCase.execute(adminActor, new GetUserInputDto(link.userId)),
    ).rejects.toThrow(ConflictException);
    expect(userRepoMock.removeCompanyLink).not.toHaveBeenCalled();
  });
});
