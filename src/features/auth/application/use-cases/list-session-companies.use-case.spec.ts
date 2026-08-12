import { Test } from '@nestjs/testing';
import { UserType } from '../../domain/constants/user-type.constant';
import { AuthenticatedUserEntity } from '../../domain/entities/authenticated-user.entity';
import { UserCompanyEntity } from '../../domain/entities/user-company.entity';
import {
  UserCompanyRepository,
  USER_COMPANY_REPOSITORY,
} from '../../domain/repositories/user-company.repository';
import { ListSessionCompaniesUseCase } from './list-session-companies.use-case';

describe('ListSessionCompaniesUseCase', () => {
  let useCase: ListSessionCompaniesUseCase;

  const userCompanyRepoMock = {
    findActiveByUserId: jest.fn(),
  } as jest.Mocked<Pick<UserCompanyRepository, 'findActiveByUserId'>>;

  const actor: AuthenticatedUserEntity = {
    id: '30000000-0000-0000-0000-000000000001',
    companyId: '10000000-0000-0000-0000-000000000001',
    email: 'admin@somar.local',
    name: 'Administrador',
    type: UserType.EMPLOYEE,
    roleCodes: ['Administração'],
    permissions: [],
  };

  const somarLink: UserCompanyEntity = {
    id: '5835f16a-7f20-4d0b-bb79-18fbad05e867',
    userId: actor.id,
    companyId: '10000000-0000-0000-0000-000000000001',
    companyName: 'SOMAR',
    type: UserType.EMPLOYEE,
    isActive: true,
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module = await Test.createTestingModule({
      providers: [
        ListSessionCompaniesUseCase,
        {
          provide: USER_COMPANY_REPOSITORY,
          useValue: userCompanyRepoMock,
        },
      ],
    }).compile();
    useCase = module.get(ListSessionCompaniesUseCase);
  });

  it('lista as empresas ativas da pessoa', async () => {
    userCompanyRepoMock.findActiveByUserId.mockResolvedValue([somarLink]);

    const result = await useCase.execute(actor);

    expect(result).toEqual([
      { id: somarLink.companyId, name: somarLink.companyName },
    ]);
    expect(userCompanyRepoMock.findActiveByUserId).toHaveBeenCalledWith(
      actor.id,
    );
  });

  it('devolve lista vazia quando não há vínculos ativos', async () => {
    userCompanyRepoMock.findActiveByUserId.mockResolvedValue([]);

    await expect(useCase.execute(actor)).resolves.toEqual([]);
  });
});
