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
import type { UserRoleRepository } from '../../domain/repositories/user-role.repository';

// Repositories
import { AUTH_REPOSITORY } from '../../../auth/domain/repositories/auth.repository';
import { USER_COMPANY_REPOSITORY } from '../../../auth/domain/repositories/user-company.repository';
import { USER_ROLE_REPOSITORY } from '../../domain/repositories/user-role.repository';

// DTO
import { GetUserInputDto } from '../../application/dto/get-user-input.dto';

// Use case
import { DeactivateUserUseCase } from '../../application/use-cases/deactivate-user.use-case';

describe('DeactivateUserUseCase', () => {
  let useCase: DeactivateUserUseCase;

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

  const userRoleRepoMock = {
    listByUserIdAndCompanyId: jest.fn(),
  } as jest.Mocked<Pick<UserRoleRepository, 'listByUserIdAndCompanyId'>>;

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
    observation: null,
    photoUrl: null,
    type: UserType.EMPLOYEE,
    isActive: true,
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    authRepoMock.findHasAdminRoleByUserIdAndCompanyId.mockResolvedValue(false);
    authRepoMock.countAdminsByCompanyId.mockResolvedValue(2);
    userCompanyRepoMock.updateById.mockResolvedValue({
      id: link.linkId,
      userId: link.userId,
      companyId: adminActor.companyId,
      companyName: 'SOMAR',
      type: link.type,
      isActive: false,
    });
    userRoleRepoMock.listByUserIdAndCompanyId.mockResolvedValue([]);

    const module = await Test.createTestingModule({
      providers: [
        DeactivateUserUseCase,
        {
          provide: USER_COMPANY_REPOSITORY,
          useValue: userCompanyRepoMock,
        },
        { provide: AUTH_REPOSITORY, useValue: authRepoMock },
        { provide: USER_ROLE_REPOSITORY, useValue: userRoleRepoMock },
      ],
    }).compile();
    useCase = module.get(DeactivateUserUseCase);
  });

  it('desativa a participação (soft) sem excluir a pessoa', async () => {
    userCompanyRepoMock.findByUserIdAndCompanyId.mockResolvedValue(link);

    const result = await useCase.execute(
      adminActor,
      new GetUserInputDto(link.userId),
    );

    expect(userCompanyRepoMock.updateById).toHaveBeenCalledWith(link.linkId, {
      isActive: false,
    });
    expect(result).toEqual(expect.objectContaining({ isActive: false }));
  });

  it('lança NotFound quando o usuário não tem vínculo com a empresa', async () => {
    userCompanyRepoMock.findByUserIdAndCompanyId.mockResolvedValue(null);

    await expect(
      useCase.execute(adminActor, new GetUserInputDto(link.userId)),
    ).rejects.toThrow(NotFoundException);
    expect(userCompanyRepoMock.updateById).not.toHaveBeenCalled();
  });

  it('rejeita desativar o último admin ativo (409)', async () => {
    userCompanyRepoMock.findByUserIdAndCompanyId.mockResolvedValue(link);
    authRepoMock.findHasAdminRoleByUserIdAndCompanyId.mockResolvedValue(true);
    authRepoMock.countAdminsByCompanyId.mockResolvedValue(1);

    await expect(
      useCase.execute(adminActor, new GetUserInputDto(link.userId)),
    ).rejects.toThrow(ConflictException);
    expect(userCompanyRepoMock.updateById).not.toHaveBeenCalled();
  });

  it('rejeita desativar usuário admin por não-admin (403)', async () => {
    userCompanyRepoMock.findByUserIdAndCompanyId.mockResolvedValue(link);
    authRepoMock.findHasAdminRoleByUserIdAndCompanyId.mockResolvedValue(true);

    await expect(
      useCase.execute(nonAdminActor, new GetUserInputDto(link.userId)),
    ).rejects.toThrow(ForbiddenException);
    expect(userCompanyRepoMock.updateById).not.toHaveBeenCalled();
  });
});
