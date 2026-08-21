// NestJS
import { Test } from '@nestjs/testing';

// Shared
import { PermissionCode } from '../../../../shared/constants/access-control.constant';

// Constants
import { UserType } from '../../../auth/domain/constants/user-type.constant';

// Types
import type { AuthenticatedUserEntity } from '../../../auth/domain/entities/authenticated-user.entity';
import type { UserCompanyRepository } from '../../../auth/domain/repositories/user-company.repository';

// Repository
import { USER_COMPANY_REPOSITORY } from '../../../auth/domain/repositories/user-company.repository';

// DTO
import { ListDriverCandidatesInputDto } from '../../application/dto/list-driver-candidates-input.dto';

// Use case
import { ListDriverCandidatesUseCase } from '../../application/use-cases/list-driver-candidates.use-case';

describe('ListDriverCandidatesUseCase', () => {
  let useCase: ListDriverCandidatesUseCase;

  const userCompanyRepoMock = {
    listByCompanyId: jest.fn(),
  } as jest.Mocked<Pick<UserCompanyRepository, 'listByCompanyId'>>;

  const actor: AuthenticatedUserEntity = {
    id: '30000000-0000-0000-0000-000000000001',
    companyId: '10000000-0000-0000-0000-000000000001',
    email: 'admin@somar.local',
    name: 'Administrador',
    type: UserType.EMPLOYEE,
    isAdmin: true,
    roleCodes: ['Administração'],
    permissions: [PermissionCode.MANAGE_VEHICLES],
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module = await Test.createTestingModule({
      providers: [
        ListDriverCandidatesUseCase,
        { provide: USER_COMPANY_REPOSITORY, useValue: userCompanyRepoMock },
      ],
    }).compile();
    useCase = module.get(ListDriverCandidatesUseCase);
  });

  it('lista candidatos com vínculo ativo da empresa do ator', async () => {
    userCompanyRepoMock.listByCompanyId.mockResolvedValue({
      data: [
        {
          linkId: '60000000-0000-0000-0000-000000000001',
          userId: '30000000-0000-0000-0000-000000000002',
          name: 'João Silva',
          email: 'joao@somar.local',
          phone: null,
          document: null,
          photoUrl: null,
          type: UserType.EMPLOYEE,
          isActive: true,
        },
        {
          linkId: '60000000-0000-0000-0000-000000000002',
          userId: '30000000-0000-0000-0000-000000000003',
          name: 'Maria Souza',
          email: 'maria@somar.local',
          phone: null,
          document: null,
          photoUrl: null,
          type: UserType.EMPLOYEE,
          isActive: true,
        },
      ],
      count: 2,
    });

    const result = await useCase.execute(
      actor,
      new ListDriverCandidatesInputDto(undefined, 20, 0),
    );

    expect(userCompanyRepoMock.listByCompanyId).toHaveBeenCalledWith(
      actor.companyId,
      {
        search: undefined,
        isActive: true,
        limit: 20,
        offset: 0,
      },
    );
    expect(result).toEqual({
      limit: 20,
      offset: 0,
      count: 2,
      data: [
        { id: '30000000-0000-0000-0000-000000000002', name: 'João Silva' },
        { id: '30000000-0000-0000-0000-000000000003', name: 'Maria Souza' },
      ],
    });
  });

  it('repassa busca e paginação para o repositório', async () => {
    userCompanyRepoMock.listByCompanyId.mockResolvedValue({
      data: [],
      count: 0,
    });

    await useCase.execute(
      actor,
      new ListDriverCandidatesInputDto('joa', 10, 20),
    );

    expect(userCompanyRepoMock.listByCompanyId).toHaveBeenCalledWith(
      actor.companyId,
      {
        search: 'joa',
        isActive: true,
        limit: 10,
        offset: 20,
      },
    );
  });
});
