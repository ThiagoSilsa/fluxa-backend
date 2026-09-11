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
import { ListRoleOptionsInputDto } from '../../application/dto/list-role-options-input.dto';

// Use case
import { ListRoleOptionsUseCase } from '../../application/use-cases/list-role-options.use-case';

describe('ListRoleOptionsUseCase', () => {
  let useCase: ListRoleOptionsUseCase;

  const roleRepoMock = {
    list: jest.fn(),
  } as jest.Mocked<Pick<RoleRepository, 'list'>>;

  const actor: AuthenticatedUserEntity = {
    id: '30000000-0000-0000-0000-000000000010',
    companyId: '10000000-0000-0000-0000-000000000001',
    email: 'gestor@somar.local',
    name: 'Gestor',
    type: UserType.EMPLOYEE,
    isAdmin: false,
    roleCodes: ['Gestor'],
    permissions: [PermissionCode.MANAGE_ACCESS_REQUESTS],
  };

  const role: RoleEntity = {
    id: '40000000-0000-0000-0000-000000000004',
    companyId: actor.companyId,
    name: 'Porteiro',
    description: 'Porteiro da portaria',
    isAdmin: false,
    isActive: true,
    createdAt: new Date('2026-08-15T00:00:00Z'),
    updatedAt: new Date('2026-08-15T00:00:00Z'),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module = await Test.createTestingModule({
      providers: [
        ListRoleOptionsUseCase,
        { provide: ROLE_REPOSITORY, useValue: roleRepoMock },
      ],
    }).compile();
    useCase = module.get(ListRoleOptionsUseCase);
  });

  it('lista apenas cargos ativos e devolve itens enxutos { id, name } no formato padrão', async () => {
    roleRepoMock.list.mockResolvedValue({ data: [role], count: 1 });

    const result = await useCase.execute(
      actor,
      new ListRoleOptionsInputDto(20, 0),
    );

    expect(roleRepoMock.list).toHaveBeenCalledWith(actor.companyId, {
      isActive: true,
      limit: 20,
      offset: 0,
    });
    expect(result).toEqual({
      limit: 20,
      offset: 0,
      data: [{ id: role.id, name: 'Porteiro' }],
      count: 1,
    });
  });

  it('repassa a paginação para o repositório', async () => {
    roleRepoMock.list.mockResolvedValue({ data: [], count: 0 });

    await useCase.execute(actor, new ListRoleOptionsInputDto(50, 10));

    expect(roleRepoMock.list).toHaveBeenCalledWith(actor.companyId, {
      isActive: true,
      limit: 50,
      offset: 10,
    });
  });

  it('devolve página vazia quando não há cargos', async () => {
    roleRepoMock.list.mockResolvedValue({ data: [], count: 0 });

    const result = await useCase.execute(
      actor,
      new ListRoleOptionsInputDto(20, 0),
    );

    expect(result).toEqual({ limit: 20, offset: 0, data: [], count: 0 });
  });
});
