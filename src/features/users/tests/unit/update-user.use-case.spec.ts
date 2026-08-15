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
import type { UserEntity } from '../../domain/entities/user.entity';
import type { UserRepository } from '../../domain/repositories/user.repository';

// Repositories
import { AUTH_REPOSITORY } from '../../../auth/domain/repositories/auth.repository';
import { USER_COMPANY_REPOSITORY } from '../../../auth/domain/repositories/user-company.repository';
import { USER_REPOSITORY } from '../../domain/repositories/user.repository';

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

  const anotherPerson: UserEntity = {
    id: '60000000-0000-0000-0000-000000000002',
    name: 'Outra',
    email: 'outra@somar.local',
    passwordHash: '$2b$10$hash',
    phone: null,
    document: '98765432100',
    observation: null,
    photoUrl: null,
    lastLoginAt: null,
    createdAt: new Date('2026-08-15T00:00:00Z'),
    updatedAt: new Date('2026-08-15T00:00:00Z'),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    authRepoMock.findHasAdminRoleByUserIdAndCompanyId.mockResolvedValue(false);
    authRepoMock.countAdminsByCompanyId.mockResolvedValue(2);
    userRepoMock.updateById.mockResolvedValue(null);
    userCompanyRepoMock.updateById.mockResolvedValue(null);

    const module = await Test.createTestingModule({
      providers: [
        UpdateUserUseCase,
        { provide: USER_REPOSITORY, useValue: userRepoMock },
        {
          provide: USER_COMPANY_REPOSITORY,
          useValue: userCompanyRepoMock,
        },
        { provide: AUTH_REPOSITORY, useValue: authRepoMock },
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
});
