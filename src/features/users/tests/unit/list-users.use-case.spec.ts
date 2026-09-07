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
import type { RoleRepository } from '../../../roles/domain/repositories/role.repository';

// Repository
import { USER_COMPANY_REPOSITORY } from '../../../auth/domain/repositories/user-company.repository';
import { USER_ROLE_REPOSITORY } from '../../domain/repositories/user-role.repository';
import { ROLE_REPOSITORY } from '../../../roles/domain/repositories/role.repository';

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

  const roleRepoMock = {
    list: jest.fn(),
  } as jest.Mocked<Pick<RoleRepository, 'list'>>;

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
    roleRepoMock.list.mockResolvedValue({ data: [], count: 0 });
    const module = await Test.createTestingModule({
      providers: [
        ListUsersUseCase,
        {
          provide: USER_COMPANY_REPOSITORY,
          useValue: userCompanyRepoMock,
        },
        { provide: USER_ROLE_REPOSITORY, useValue: userRoleRepoMock },
        { provide: ROLE_REPOSITORY, useValue: roleRepoMock },
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
          photoUrl: null,
          type: UserType.EMPLOYEE,
          isActive: true,
          role: null,
        },
      ],
      count: 1,
      parameters: [{ key: 'role_id', label: 'Cargo', allowed_values: [] }],
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

  it('inclui os cargos ativos em parameters (Select sem depender de GET /roles)', async () => {
    userCompanyRepoMock.listByCompanyId.mockResolvedValue({
      data: [],
      count: 0,
    });
    roleRepoMock.list.mockResolvedValue({
      data: [
        {
          id: '20000000-0000-0000-0000-000000000004',
          companyId: actor.companyId,
          name: 'Porteiro',
          description: null,
          isAdmin: false,
          isActive: true,
          createdAt: new Date('2026-08-15T00:00:00Z'),
          updatedAt: new Date('2026-08-15T00:00:00Z'),
        },
        {
          id: '20000000-0000-0000-0000-000000000001',
          companyId: actor.companyId,
          name: 'Administração',
          description: null,
          isAdmin: true,
          isActive: true,
          createdAt: new Date('2026-08-15T00:00:00Z'),
          updatedAt: new Date('2026-08-15T00:00:00Z'),
        },
      ],
      count: 2,
    });

    const result = await useCase.execute(
      actor,
      new ListUsersInputDto(undefined, undefined, undefined, 10, 0),
    );

    expect(roleRepoMock.list).toHaveBeenCalledWith(actor.companyId, {
      isActive: true,
      limit: 100,
      offset: 0,
    });
    expect(result.parameters).toEqual([
      {
        key: 'role_id',
        label: 'Cargo',
        allowed_values: [
          {
            id: '20000000-0000-0000-0000-000000000004',
            name: 'Porteiro',
            isAdmin: false,
          },
          {
            id: '20000000-0000-0000-0000-000000000001',
            name: 'Administração',
            isAdmin: true,
          },
        ],
      },
    ]);
  });
});
