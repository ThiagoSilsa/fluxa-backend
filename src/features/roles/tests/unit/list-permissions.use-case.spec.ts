// NestJS
import { Test } from '@nestjs/testing';

// Shared
import { PermissionCode } from '../../../../shared/constants/access-control.constant';

// Constants
import { UserType } from '../../../auth/domain/constants/user-type.constant';

// Types
import type { AuthenticatedUserEntity } from '../../../auth/domain/entities/authenticated-user.entity';
import type { PermissionRepository } from '../../domain/repositories/permission.repository';

// Repository
import { PERMISSION_REPOSITORY } from '../../domain/repositories/permission.repository';

// Use case
import { ListPermissionsUseCase } from '../../application/use-cases/list-permissions.use-case';

describe('ListPermissionsUseCase', () => {
  let useCase: ListPermissionsUseCase;

  const permissionRepoMock = {
    listAll: jest.fn(),
  } as jest.Mocked<Pick<PermissionRepository, 'listAll'>>;

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

  beforeEach(async () => {
    jest.clearAllMocks();
    const module = await Test.createTestingModule({
      providers: [
        ListPermissionsUseCase,
        { provide: PERMISSION_REPOSITORY, useValue: permissionRepoMock },
      ],
    }).compile();
    useCase = module.get(ListPermissionsUseCase);
  });

  it('devolve o catálogo global de permissões mapeado para resposta', async () => {
    permissionRepoMock.listAll.mockResolvedValue([
      { id: 'p1', code: 'MANAGE_ROLES', description: 'Gerencia cargos' },
      { id: 'p2', code: 'REGISTER_ENTRY', description: null },
    ]);

    const result = await useCase.execute(actor);

    expect(permissionRepoMock.listAll).toHaveBeenCalled();
    expect(result).toEqual([
      { id: 'p1', code: 'MANAGE_ROLES', description: 'Gerencia cargos' },
      { id: 'p2', code: 'REGISTER_ENTRY', description: null },
    ]);
  });

  it('devolve lista vazia quando o catálogo está vazio', async () => {
    permissionRepoMock.listAll.mockResolvedValue([]);

    await expect(useCase.execute(actor)).resolves.toEqual([]);
  });
});
