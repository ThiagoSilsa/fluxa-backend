// NestJS
import { Test } from '@nestjs/testing';

// Shared
import { PermissionCode } from '../../../../shared/constants/access-control.constant';

// Constants
import { UserType } from '../../domain/constants/user-type.constant';

// Types
import type { AuthUserEntity } from '../../domain/entities/auth-user.entity';
import type { AuthRepository } from '../../domain/repositories/auth.repository';

// Repository
import { AUTH_REPOSITORY } from '../../domain/repositories/auth.repository';

// Use-cases
import { ResolveAuthenticatedUserUseCase } from '../../application/use-cases/resolve-authenticated-user.use-case';

describe('ResolveAuthenticatedUserUseCase', () => {
  let useCase: ResolveAuthenticatedUserUseCase;

  const authRepoMock = {
    findUserInCompany: jest.fn(),
    findRoleCodesByUserIdAndCompanyId: jest.fn(),
    findPermissionsByUserIdAndCompanyId: jest.fn(),
    findHasAdminRoleByUserIdAndCompanyId: jest.fn(),
  } as jest.Mocked<
    Pick<
      AuthRepository,
      | 'findUserInCompany'
      | 'findRoleCodesByUserIdAndCompanyId'
      | 'findPermissionsByUserIdAndCompanyId'
      | 'findHasAdminRoleByUserIdAndCompanyId'
    >
  >;

  const activeCandidate: AuthUserEntity = {
    id: '30000000-0000-0000-0000-000000000001',
    name: 'Administrador',
    email: 'admin@somar.local',
    passwordHash: '$2b$10$hash',
    companyId: '10000000-0000-0000-0000-000000000001',
    companyName: 'SOMAR',
    companyIsActive: true,
    type: UserType.EMPLOYEE,
    isActive: true,
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module = await Test.createTestingModule({
      providers: [
        ResolveAuthenticatedUserUseCase,
        {
          provide: AUTH_REPOSITORY,
          useValue: authRepoMock,
        },
      ],
    }).compile();
    useCase = module.get(ResolveAuthenticatedUserUseCase);
  });

  it('resolve o ator com papéis e permissões da empresa da sessão', async () => {
    authRepoMock.findUserInCompany.mockResolvedValue(activeCandidate);
    authRepoMock.findRoleCodesByUserIdAndCompanyId.mockResolvedValue([
      'Administração',
    ]);
    authRepoMock.findPermissionsByUserIdAndCompanyId.mockResolvedValue([
      PermissionCode.MANAGE_USERS,
      PermissionCode.REGISTER_ENTRY,
    ]);
    authRepoMock.findHasAdminRoleByUserIdAndCompanyId.mockResolvedValue(true);

    const result = await useCase.execute(
      activeCandidate.id,
      activeCandidate.companyId,
    );

    expect(result).toEqual({
      id: activeCandidate.id,
      companyId: activeCandidate.companyId,
      email: activeCandidate.email,
      name: activeCandidate.name,
      type: activeCandidate.type,
      isAdmin: true,
      roleCodes: ['Administração'],
      permissions: ['MANAGE_USERS', 'REGISTER_ENTRY'],
    });
  });

  it('inclui isAdmin conforme o cargo ativo da pessoa na empresa', async () => {
    authRepoMock.findUserInCompany.mockResolvedValue(activeCandidate);
    authRepoMock.findRoleCodesByUserIdAndCompanyId.mockResolvedValue([]);
    authRepoMock.findPermissionsByUserIdAndCompanyId.mockResolvedValue([]);
    authRepoMock.findHasAdminRoleByUserIdAndCompanyId.mockResolvedValue(true);

    const result = await useCase.execute(
      activeCandidate.id,
      activeCandidate.companyId,
    );

    expect(result?.isAdmin).toBe(true);
    expect(
      authRepoMock.findHasAdminRoleByUserIdAndCompanyId,
    ).toHaveBeenCalledWith(activeCandidate.id, activeCandidate.companyId);
  });

  it('retorna null quando o vínculo não existe', async () => {
    authRepoMock.findUserInCompany.mockResolvedValue(null);

    await expect(
      useCase.execute(
        '00000000-0000-0000-0000-000000000000',
        '10000000-0000-0000-0000-000000000001',
      ),
    ).resolves.toBeNull();
  });

  it('retorna null quando o vínculo está inativo', async () => {
    authRepoMock.findUserInCompany.mockResolvedValue({
      ...activeCandidate,
      isActive: false,
    });

    await expect(
      useCase.execute(activeCandidate.id, activeCandidate.companyId),
    ).resolves.toBeNull();
    expect(
      authRepoMock.findRoleCodesByUserIdAndCompanyId,
    ).not.toHaveBeenCalled();
  });

  it('retorna null quando a empresa está inativa', async () => {
    authRepoMock.findUserInCompany.mockResolvedValue({
      ...activeCandidate,
      companyIsActive: false,
    });

    await expect(
      useCase.execute(activeCandidate.id, activeCandidate.companyId),
    ).resolves.toBeNull();
  });
});
