// NestJS
import { NotFoundException } from '@nestjs/common';
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
import { GetUserInputDto } from '../../application/dto/get-user-input.dto';

// Use case
import { GetUserUseCase } from '../../application/use-cases/get-user.use-case';

describe('GetUserUseCase', () => {
  let useCase: GetUserUseCase;

  const userCompanyRepoMock = {
    findByUserIdAndCompanyId: jest.fn(),
  } as jest.Mocked<Pick<UserCompanyRepository, 'findByUserIdAndCompanyId'>>;

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
    const module = await Test.createTestingModule({
      providers: [
        GetUserUseCase,
        {
          provide: USER_COMPANY_REPOSITORY,
          useValue: userCompanyRepoMock,
        },
      ],
    }).compile();
    useCase = module.get(GetUserUseCase);
  });

  it('devolve os dados do usuário com vínculo na empresa', async () => {
    userCompanyRepoMock.findByUserIdAndCompanyId.mockResolvedValue({
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
    });

    const result = await useCase.execute(
      actor,
      new GetUserInputDto('60000000-0000-0000-0000-000000000001'),
    );

    expect(userCompanyRepoMock.findByUserIdAndCompanyId).toHaveBeenCalledWith(
      '60000000-0000-0000-0000-000000000001',
      actor.companyId,
    );
    expect(result).toEqual({
      id: '60000000-0000-0000-0000-000000000001',
      name: 'Maria',
      email: 'maria@somar.local',
      phone: '11999999999',
      document: '12345678900',
      observation: null,
      photoUrl: null,
      type: UserType.EMPLOYEE,
      isActive: true,
    });
  });

  it('lança NotFound quando o usuário não tem vínculo com a empresa', async () => {
    userCompanyRepoMock.findByUserIdAndCompanyId.mockResolvedValue(null);

    await expect(
      useCase.execute(
        actor,
        new GetUserInputDto('60000000-0000-0000-0000-000000000001'),
      ),
    ).rejects.toThrow(NotFoundException);
  });
});
