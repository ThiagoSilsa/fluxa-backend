// NestJS
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { QueryFailedError } from 'typeorm';

// Shared
import { PermissionCode } from '../../../../shared/constants/access-control.constant';
import { PasswordHashUseCase } from '../../../../shared/security/password-hash.use-case';

// Constants
import { UserType } from '../../../auth/domain/constants/user-type.constant';

// Types
import type { AuthenticatedUserEntity } from '../../../auth/domain/entities/authenticated-user.entity';
import type { UserCompanyRepository } from '../../../auth/domain/repositories/user-company.repository';
import type { RoleEntity } from '../../../roles/domain/entities/role.entity';
import type { RoleRepository } from '../../../roles/domain/repositories/role.repository';
import type { UserEntity } from '../../domain/entities/user.entity';
import type { UserRoleWithRoleEntity } from '../../domain/entities/user-role.entity';
import type { UserRoleRepository } from '../../domain/repositories/user-role.repository';
import type { UserRepository } from '../../domain/repositories/user.repository';

// Repositories
import { USER_COMPANY_REPOSITORY } from '../../../auth/domain/repositories/user-company.repository';
import { ROLE_REPOSITORY } from '../../../roles/domain/repositories/role.repository';
import { USER_REPOSITORY } from '../../domain/repositories/user.repository';
import { USER_ROLE_REPOSITORY } from '../../domain/repositories/user-role.repository';

// DTO
import { CreateUserInputDto } from '../../application/dto/create-user-input.dto';

// Use case
import { CreateUserUseCase } from '../../application/use-cases/create-user.use-case';

describe('CreateUserUseCase', () => {
  let useCase: CreateUserUseCase;

  const userRepoMock = {
    findByEmail: jest.fn(),
    findByDocument: jest.fn(),
    create: jest.fn(),
  } as jest.Mocked<
    Pick<UserRepository, 'findByEmail' | 'findByDocument' | 'create'>
  >;

  const userCompanyRepoMock = {
    existsByUserIdAndCompanyId: jest.fn(),
    create: jest.fn(),
  } as jest.Mocked<
    Pick<UserCompanyRepository, 'existsByUserIdAndCompanyId' | 'create'>
  >;

  const passwordHashMock = {
    execute: jest.fn(),
  } as jest.Mocked<Pick<PasswordHashUseCase, 'execute'>>;

  const roleRepoMock = {
    findByIdAndCompanyId: jest.fn(),
  } as jest.Mocked<Pick<RoleRepository, 'findByIdAndCompanyId'>>;

  const userRoleRepoMock = {
    listByUserIdAndCompanyId: jest.fn(),
    create: jest.fn(),
  } as jest.Mocked<
    Pick<UserRoleRepository, 'listByUserIdAndCompanyId' | 'create'>
  >;

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

  const nonAdminActor: AuthenticatedUserEntity = {
    ...actor,
    id: '30000000-0000-0000-0000-000000000002',
    isAdmin: false,
  };

  const existingPerson: UserEntity = {
    id: '60000000-0000-0000-0000-000000000001',
    name: 'Maria',
    email: 'maria@somar.local',
    passwordHash: '$2b$10$hash',
    phone: '11999999999',
    document: '12345678900',
    photoUrl: null,
    lastLoginAt: null,
    createdAt: new Date('2026-08-15T00:00:00Z'),
    updatedAt: new Date('2026-08-15T00:00:00Z'),
  };

  const newPerson: UserEntity = {
    ...existingPerson,
    id: '60000000-0000-0000-0000-000000000002',
    name: 'Novo Usuário',
    email: 'novo@somar.local',
    phone: null,
    document: null,
  };

  const porteiroRole: RoleEntity = {
    id: '20000000-0000-0000-0000-000000000004',
    companyId: actor.companyId,
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
    userId: newPerson.id,
    roleId: porteiroRole.id,
    roleName: 'Porteiro',
    roleIsAdmin: false,
    roleIsActive: true,
    createdAt: new Date('2026-08-15T00:00:00Z'),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    passwordHashMock.execute.mockReturnValue('$2b$10$hashed');
    userCompanyRepoMock.existsByUserIdAndCompanyId.mockResolvedValue(false);
    userCompanyRepoMock.create.mockResolvedValue({} as never);
    userRoleRepoMock.listByUserIdAndCompanyId.mockResolvedValue([]);
    userRoleRepoMock.create.mockResolvedValue();

    const module = await Test.createTestingModule({
      providers: [
        CreateUserUseCase,
        { provide: USER_REPOSITORY, useValue: userRepoMock },
        {
          provide: USER_COMPANY_REPOSITORY,
          useValue: userCompanyRepoMock,
        },
        { provide: ROLE_REPOSITORY, useValue: roleRepoMock },
        { provide: USER_ROLE_REPOSITORY, useValue: userRoleRepoMock },
        { provide: PasswordHashUseCase, useValue: passwordHashMock },
      ],
    }).compile();
    useCase = module.get(CreateUserUseCase);
  });

  it('cria pessoa nova + vínculo na mesma operação (ADR 0005)', async () => {
    userRepoMock.findByEmail.mockResolvedValue(null);
    userRepoMock.create.mockResolvedValue(newPerson);

    const result = await useCase.execute(
      actor,
      new CreateUserInputDto(
        'novo@somar.local',
        UserType.EMPLOYEE,
        'Novo Usuário',
        'senha123',
      ),
    );

    expect(userRepoMock.findByEmail).toHaveBeenCalledWith('novo@somar.local');
    expect(passwordHashMock.execute).toHaveBeenCalledWith('senha123');
    expect(userRepoMock.create).toHaveBeenCalledWith({
      name: 'Novo Usuário',
      email: 'novo@somar.local',
      passwordHash: '$2b$10$hashed',
      phone: null,
      document: null,
      companyId: actor.companyId,
      type: UserType.EMPLOYEE,
      isActive: true,
      roleId: undefined,
    });
    expect(result).toEqual({
      id: newPerson.id,
      name: 'Novo Usuário',
      email: 'novo@somar.local',
      phone: null,
      document: null,
      photoUrl: null,
      type: UserType.EMPLOYEE,
      isActive: true,
      role: null,
      createdUser: true,
    });
  });

  it('cria pessoa nova já com cargo (roleId na mesma transação)', async () => {
    userRepoMock.findByEmail.mockResolvedValue(null);
    userRepoMock.create.mockResolvedValue(newPerson);
    roleRepoMock.findByIdAndCompanyId.mockResolvedValue(porteiroRole);
    userRoleRepoMock.listByUserIdAndCompanyId.mockResolvedValue([
      porteiroRoleSummary,
    ]);

    const result = await useCase.execute(
      actor,
      new CreateUserInputDto(
        'novo@somar.local',
        UserType.EMPLOYEE,
        'Novo Usuário',
        'senha123',
        undefined,
        undefined,
        porteiroRole.id,
      ),
    );

    expect(roleRepoMock.findByIdAndCompanyId).toHaveBeenCalledWith(
      porteiroRole.id,
      actor.companyId,
    );
    expect(userRepoMock.create).toHaveBeenCalledWith(
      expect.objectContaining({ roleId: porteiroRole.id }),
    );
    expect(result.role).toEqual({
      userRoleId: porteiroRoleSummary.userRoleId,
      roleId: porteiroRole.id,
      roleName: 'Porteiro',
      isAdmin: false,
    });
    expect(result.createdUser).toBe(true);
  });

  it('vincula pessoa existente já com cargo (cria user_role após o vínculo)', async () => {
    userRepoMock.findByEmail.mockResolvedValue(existingPerson);
    userCompanyRepoMock.create.mockResolvedValue({} as never);
    roleRepoMock.findByIdAndCompanyId.mockResolvedValue(porteiroRole);
    userRoleRepoMock.listByUserIdAndCompanyId.mockResolvedValue([
      porteiroRoleSummary,
    ]);

    const result = await useCase.execute(
      actor,
      new CreateUserInputDto(
        'maria@somar.local',
        UserType.EMPLOYEE,
        undefined,
        undefined,
        undefined,
        undefined,
        porteiroRole.id,
      ),
    );

    expect(userRoleRepoMock.create).toHaveBeenCalledWith(
      existingPerson.id,
      porteiroRole.id,
      actor.companyId,
    );
    expect(result.role).toEqual({
      userRoleId: porteiroRoleSummary.userRoleId,
      roleId: porteiroRole.id,
      roleName: 'Porteiro',
      isAdmin: false,
    });
    expect(result.createdUser).toBe(false);
  });

  it('rejeita cargo fora da empresa da sessão (404)', async () => {
    userRepoMock.findByEmail.mockResolvedValue(null);
    roleRepoMock.findByIdAndCompanyId.mockResolvedValue(null);

    await expect(
      useCase.execute(
        actor,
        new CreateUserInputDto(
          'novo@somar.local',
          UserType.EMPLOYEE,
          'Novo Usuário',
          'senha123',
          undefined,
          undefined,
          porteiroRole.id,
        ),
      ),
    ).rejects.toThrow(NotFoundException);
    expect(userRepoMock.create).not.toHaveBeenCalled();
  });

  it('rejeita atribuir cargo is_admin por ator não-admin (403)', async () => {
    userRepoMock.findByEmail.mockResolvedValue(null);
    roleRepoMock.findByIdAndCompanyId.mockResolvedValue(adminRole);

    await expect(
      useCase.execute(
        nonAdminActor,
        new CreateUserInputDto(
          'novo@somar.local',
          UserType.EMPLOYEE,
          'Novo Usuário',
          'senha123',
          undefined,
          undefined,
          adminRole.id,
        ),
      ),
    ).rejects.toThrow(ForbiddenException);
    expect(userRepoMock.create).not.toHaveBeenCalled();
  });

  it('normaliza o e-mail antes de buscar e criar', async () => {
    userRepoMock.findByEmail.mockResolvedValue(null);
    userRepoMock.create.mockResolvedValue(newPerson);

    await useCase.execute(
      actor,
      new CreateUserInputDto(
        '  Novo@Somar.Local ',
        UserType.EMPLOYEE,
        'Novo Usuário',
        'senha123',
      ),
    );

    expect(userRepoMock.findByEmail).toHaveBeenCalledWith('novo@somar.local');
    expect(userRepoMock.create).toHaveBeenCalledWith(
      expect.objectContaining({ email: 'novo@somar.local' }),
    );
  });

  it('vincula pessoa já existente em outra empresa sem criar user novo', async () => {
    userRepoMock.findByEmail.mockResolvedValue(existingPerson);
    userCompanyRepoMock.create.mockResolvedValue({
      id: '70000000-0000-0000-0000-000000000001',
      userId: existingPerson.id,
      companyId: actor.companyId,
      companyName: 'SOMAR',
      type: UserType.VISITOR,
      isActive: true,
    });

    const result = await useCase.execute(
      actor,
      new CreateUserInputDto('maria@somar.local', UserType.VISITOR),
    );

    expect(userRepoMock.create).not.toHaveBeenCalled();
    expect(userCompanyRepoMock.existsByUserIdAndCompanyId).toHaveBeenCalledWith(
      existingPerson.id,
      actor.companyId,
    );
    expect(userCompanyRepoMock.create).toHaveBeenCalledWith({
      userId: existingPerson.id,
      companyId: actor.companyId,
      type: UserType.VISITOR,
      isActive: true,
    });
    expect(result).toEqual({
      id: existingPerson.id,
      name: 'Maria',
      email: 'maria@somar.local',
      phone: '11999999999',
      document: '12345678900',
      photoUrl: null,
      type: UserType.VISITOR,
      isActive: true,
      role: null,
      createdUser: false,
    });
    expect(passwordHashMock.execute).not.toHaveBeenCalled();
  });

  it('rejeita nome enviado no vínculo de pessoa existente (400)', async () => {
    userRepoMock.findByEmail.mockResolvedValue(existingPerson);

    await expect(
      useCase.execute(
        actor,
        new CreateUserInputDto(
          'maria@somar.local',
          UserType.EMPLOYEE,
          'Outro Nome',
        ),
      ),
    ).rejects.toThrow(BadRequestException);
    expect(userCompanyRepoMock.create).not.toHaveBeenCalled();
    expect(userRepoMock.create).not.toHaveBeenCalled();
  });

  it('rejeita senha enviada no vínculo de pessoa existente (400)', async () => {
    userRepoMock.findByEmail.mockResolvedValue(existingPerson);

    await expect(
      useCase.execute(
        actor,
        new CreateUserInputDto(
          'maria@somar.local',
          UserType.EMPLOYEE,
          undefined,
          'nova-senha',
        ),
      ),
    ).rejects.toThrow(BadRequestException);
    expect(userCompanyRepoMock.create).not.toHaveBeenCalled();
  });

  it('rejeita vínculo já existente com a empresa do ator (409)', async () => {
    userRepoMock.findByEmail.mockResolvedValue(existingPerson);
    userCompanyRepoMock.existsByUserIdAndCompanyId.mockResolvedValue(true);

    await expect(
      useCase.execute(
        actor,
        new CreateUserInputDto('maria@somar.local', UserType.EMPLOYEE),
      ),
    ).rejects.toThrow(ConflictException);
    expect(userCompanyRepoMock.create).not.toHaveBeenCalled();
  });

  it('rejeita documento de outra pessoa (409)', async () => {
    userRepoMock.findByEmail.mockResolvedValue(null);
    userRepoMock.findByDocument.mockResolvedValue(existingPerson);

    await expect(
      useCase.execute(
        actor,
        new CreateUserInputDto(
          'novo@somar.local',
          UserType.EMPLOYEE,
          'Novo Usuário',
          'senha123',
          undefined,
          '12345678900',
        ),
      ),
    ).rejects.toThrow(ConflictException);
    expect(userRepoMock.create).not.toHaveBeenCalled();
  });

  it('rejeita pessoa nova sem nome ou senha (400)', async () => {
    userRepoMock.findByEmail.mockResolvedValue(null);

    await expect(
      useCase.execute(
        actor,
        new CreateUserInputDto('novo@somar.local', UserType.EMPLOYEE),
      ),
    ).rejects.toThrow(BadRequestException);
    expect(userRepoMock.create).not.toHaveBeenCalled();
  });

  it('traduz violação de unique em 409 (concorrência)', async () => {
    userRepoMock.findByEmail.mockResolvedValue(null);
    const driverError = new Error(
      'duplicate key value violates unique constraint',
    ) as Error & { code: string };
    driverError.code = '23505';
    userRepoMock.create.mockRejectedValue(
      new QueryFailedError('INSERT', [], driverError),
    );

    await expect(
      useCase.execute(
        actor,
        new CreateUserInputDto(
          'novo@somar.local',
          UserType.EMPLOYEE,
          'Novo Usuário',
          'senha123',
        ),
      ),
    ).rejects.toThrow(ConflictException);
  });

  it('traduz violação de unique no vínculo em 409', async () => {
    userRepoMock.findByEmail.mockResolvedValue(existingPerson);
    const driverError = new Error(
      'duplicate key value violates unique constraint',
    ) as Error & { code: string };
    driverError.code = '23505';
    userCompanyRepoMock.create.mockRejectedValue(
      new QueryFailedError('INSERT', [], driverError),
    );

    await expect(
      useCase.execute(
        actor,
        new CreateUserInputDto('maria@somar.local', UserType.EMPLOYEE),
      ),
    ).rejects.toThrow(ConflictException);
  });
});
