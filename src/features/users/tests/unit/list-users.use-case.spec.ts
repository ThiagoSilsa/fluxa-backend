// NestJS
import { Test } from '@nestjs/testing';

// Shared
import { PermissionCode } from '../../../../shared/constants/access-control.constant';

// Constants
import { UserType } from '../../../auth/domain/constants/user-type.constant';

// Types
import type { AuthenticatedUserEntity } from '../../../auth/domain/entities/authenticated-user.entity';
import type { UserCompanyRepository } from '../../../auth/domain/repositories/user-company.repository';
import type { UserRoleRepository } from '../../domain/repositories/user-role.repository';

// Repository
import { USER_COMPANY_REPOSITORY } from '../../../auth/domain/repositories/user-company.repository';
import { USER_ROLE_REPOSITORY } from '../../domain/repositories/user-role.repository';

// DTO
import { ListUsersInputDto } from '../../application/dto/list-users-input.dto';

// Use case
import { ListUsersUseCase } from '../../application/use-cases/list-users.use-case';

describe('ListUsersUseCase', () => {
  let useCase: ListUsersUseCase;

  const userCompanyRepoMock = {
    listByCompanyId: jest.fn(),
  } as jest.Mocked<Pick<UserCompanyRepository, 'listByCompanyId'>>;

  const userRoleRepoMock = {
    listByUserIdsAndCompanyId: jest.fn(),
  } as jest.Mocked<Pick<UserRoleRepository, 'listByUserIdsAndCompanyId'>>;

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

  beforeEach(async () => {
    jest.clearAllMocks();
    userRoleRepoMock.listByUserIdsAndCompanyId.mockResolvedValue([]);
    const module = await Test.createTestingModule({
      providers: [
        ListUsersUseCase,
        {
          provide: USER_COMPANY_REPOSITORY,
          useValue: userCompanyRepoMock,
        },
        { provide: USER_ROLE_REPOSITORY, useValue: userRoleRepoMock },
      ],
    }).compile();
    useCase = module.get(ListUsersUseCase);
  });

  it('lista usuários da empresa com paginação e formato padrão', async () => {
    userCompanyRepoMock.listByCompanyId.mockResolvedValue({
      data: [
        {
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
        },
      ],
      count: 1,
    });

    const result = await useCase.execute(
      actor,
      new ListUsersInputDto(undefined, undefined, undefined, 10, 0),
    );

    expect(userCompanyRepoMock.listByCompanyId).toHaveBeenCalledWith(
      actor.companyId,
      {
        search: undefined,
        type: undefined,
        isActive: undefined,
        limit: 10,
        offset: 0,
      },
    );
    expect(result).toEqual({
      limit: 10,
      offset: 0,
      data: [
        {
          id: '60000000-0000-0000-0000-000000000001',
          name: 'Maria',
          email: 'maria@somar.local',
          phone: '11999999999',
          document: '12345678900',
          observation: null,
          photoUrl: null,
          type: UserType.EMPLOYEE,
          isActive: true,
          role: null,
        },
      ],
      count: 1,
    });
  });

  it('repassa busca, filtros e paginação ao repositório', async () => {
    userCompanyRepoMock.listByCompanyId.mockResolvedValue({
      data: [],
      count: 0,
    });

    await useCase.execute(
      actor,
      new ListUsersInputDto('mar', UserType.VISITOR, true, 5, 20),
    );

    expect(userCompanyRepoMock.listByCompanyId).toHaveBeenCalledWith(
      actor.companyId,
      {
        search: 'mar',
        type: UserType.VISITOR,
        isActive: true,
        limit: 5,
        offset: 20,
      },
    );
  });

  it('enriquece cada usuário com o resumo do cargo (em lote, sem N+1)', async () => {
    userCompanyRepoMock.listByCompanyId.mockResolvedValue({
      data: [
        {
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
        },
      ],
      count: 1,
    });
    userRoleRepoMock.listByUserIdsAndCompanyId.mockResolvedValue([
      {
        userRoleId: '80000000-0000-0000-0000-000000000001',
        userId: '60000000-0000-0000-0000-000000000001',
        roleId: '20000000-0000-0000-0000-000000000004',
        roleName: 'Porteiro',
        roleIsAdmin: false,
        roleIsActive: true,
        createdAt: new Date('2026-08-15T00:00:00Z'),
      },
    ]);

    const result = await useCase.execute(
      actor,
      new ListUsersInputDto(undefined, undefined, undefined, 10, 0),
    );

    expect(userRoleRepoMock.listByUserIdsAndCompanyId).toHaveBeenCalledWith(
      ['60000000-0000-0000-0000-000000000001'],
      actor.companyId,
    );
    expect(result.data[0].role).toEqual({
      userRoleId: '80000000-0000-0000-0000-000000000001',
      roleId: '20000000-0000-0000-0000-000000000004',
      roleName: 'Porteiro',
      isAdmin: false,
    });
  });
});
