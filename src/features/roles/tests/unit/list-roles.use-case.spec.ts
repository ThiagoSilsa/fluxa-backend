// NestJS
import { Test } from '@nestjs/testing';

// Shared
import { PermissionCode } from '../../../../shared/constants/access-control.constant';

// Constants
import { UserType } from '../../../auth/domain/constants/user-type.constant';

// Types
import type { AuthenticatedUserEntity } from '../../../auth/domain/entities/authenticated-user.entity';
import type { RoleEntity } from '../../domain/entities/role.entity';
import type { RoleRepository } from '../../domain/repositories/role.repository';

// Repository
import { ROLE_REPOSITORY } from '../../domain/repositories/role.repository';

// DTO
import { ListRolesInputDto } from '../../application/dto/list-roles-input.dto';

// Use case
import { ListRolesUseCase } from '../../application/use-cases/list-roles.use-case';

describe('ListRolesUseCase', () => {
  let useCase: ListRolesUseCase;

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
    permissions: [PermissionCode.MANAGE_ROLES],
  };

  const role: RoleEntity = {
    id: '40000000-0000-0000-0000-000000000001',
    companyId: actor.companyId,
    name: 'Porteiro',
    description: null,
    isAdmin: false,
    isActive: true,
    createdAt: new Date('2026-08-15T00:00:00Z'),
    updatedAt: new Date('2026-08-15T00:00:00Z'),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module = await Test.createTestingModule({
      providers: [
        ListRolesUseCase,
        { provide: ROLE_REPOSITORY, useValue: roleRepoMock },
      ],
    }).compile();
    useCase = module.get(ListRolesUseCase);
  });

  it('devolve a página no formato padrão (AGENTS.md §3)', async () => {
    roleRepoMock.list.mockResolvedValue({ data: [role], count: 1 });

    const result = await useCase.execute(
      actor,
      new ListRolesInputDto(undefined, 20, 0),
    );

    expect(roleRepoMock.list).toHaveBeenCalledWith(actor.companyId, {
      search: undefined,
      limit: 20,
      offset: 0,
    });
    expect(result).toEqual({
      limit: 20,
      offset: 0,
      data: [
        {
          id: role.id,
          name: 'Porteiro',
          description: null,
          isAdmin: false,
          isActive: true,
        },
      ],
      count: 1,
    });
  });

  it('repassa a busca por nome para o repositório', async () => {
    roleRepoMock.list.mockResolvedValue({ data: [], count: 0 });

    await useCase.execute(actor, new ListRolesInputDto('porte', 10, 5));

    expect(roleRepoMock.list).toHaveBeenCalledWith(actor.companyId, {
      search: 'porte',
      limit: 10,
      offset: 5,
    });
  });

  it('repassa o filtro por status (isActive) para o repositório', async () => {
    roleRepoMock.list.mockResolvedValue({ data: [], count: 0 });

    await useCase.execute(
      actor,
      new ListRolesInputDto(undefined, 10, 0, false),
    );

    expect(roleRepoMock.list).toHaveBeenCalledWith(actor.companyId, {
      search: undefined,
      isActive: false,
      limit: 10,
      offset: 0,
    });
  });
});
