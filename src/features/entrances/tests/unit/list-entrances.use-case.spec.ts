// NestJS
import { Test } from '@nestjs/testing';

// Shared
import { PermissionCode } from '../../../../shared/constants/access-control.constant';

// Constants
import { UserType } from '../../../auth/domain/constants/user-type.constant';

// Types
import type { AuthenticatedUserEntity } from '../../../auth/domain/entities/authenticated-user.entity';
import type { EntranceEntity } from '../../domain/entities/entrance.entity';
import type { EntranceRepository } from '../../domain/repositories/entrance.repository';

// Repository
import { ENTRANCE_REPOSITORY } from '../../domain/repositories/entrance.repository';

// DTO
import { ListEntrancesInputDto } from '../../application/dto/list-entrances-input.dto';

// Use case
import { ListEntrancesUseCase } from '../../application/use-cases/list-entrances.use-case';

describe('ListEntrancesUseCase', () => {
  let useCase: ListEntrancesUseCase;

  const entranceRepoMock = {
    list: jest.fn(),
  } as jest.Mocked<Pick<EntranceRepository, 'list'>>;

  const actor: AuthenticatedUserEntity = {
    id: '30000000-0000-0000-0000-000000000001',
    companyId: '10000000-0000-0000-0000-000000000001',
    email: 'admin@somar.local',
    name: 'Administrador',
    type: UserType.EMPLOYEE,
    isAdmin: true,
    roleCodes: ['Administração'],
    permissions: [PermissionCode.MANAGE_ENTRANCES],
  };

  const entrances: EntranceEntity[] = [
    {
      id: '40000000-0000-0000-0000-000000000001',
      companyId: actor.companyId,
      name: 'Portaria Principal',
      isActive: true,
      createdAt: new Date('2026-08-15T00:00:00Z'),
      updatedAt: new Date('2026-08-15T00:00:00Z'),
    },
  ];

  beforeEach(async () => {
    jest.clearAllMocks();
    const module = await Test.createTestingModule({
      providers: [
        ListEntrancesUseCase,
        { provide: ENTRANCE_REPOSITORY, useValue: entranceRepoMock },
      ],
    }).compile();
    useCase = module.get(ListEntrancesUseCase);
  });

  it('lista portarias da empresa com paginação no formato padrão', async () => {
    entranceRepoMock.list.mockResolvedValue({ data: entrances, count: 1 });

    const result = await useCase.execute(
      actor,
      new ListEntrancesInputDto(undefined, undefined, 20, 0),
    );

    expect(entranceRepoMock.list).toHaveBeenCalledWith(actor.companyId, {
      search: undefined,
      isActive: undefined,
      limit: 20,
      offset: 0,
    });
    expect(result).toEqual({
      limit: 20,
      offset: 0,
      count: 1,
      data: [
        { id: entrances[0].id, name: 'Portaria Principal', isActive: true },
      ],
    });
  });

  it('repassa busca e filtro de estado para o repositório', async () => {
    entranceRepoMock.list.mockResolvedValue({ data: [], count: 0 });

    await useCase.execute(
      actor,
      new ListEntrancesInputDto('Principal', true, 10, 5),
    );

    expect(entranceRepoMock.list).toHaveBeenCalledWith(actor.companyId, {
      search: 'Principal',
      isActive: true,
      limit: 10,
      offset: 5,
    });
  });
});
