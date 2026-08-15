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
import { CreateEntranceInputDto } from '../../application/dto/create-entrance-input.dto';

// Use case
import { CreateEntranceUseCase } from '../../application/use-cases/create-entrance.use-case';

describe('CreateEntranceUseCase', () => {
  let useCase: CreateEntranceUseCase;

  const entranceRepoMock = {
    create: jest.fn(),
  } as jest.Mocked<Pick<EntranceRepository, 'create'>>;

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

  const createdEntrance: EntranceEntity = {
    id: '40000000-0000-0000-0000-000000000001',
    companyId: actor.companyId,
    name: 'Portaria Principal',
    isActive: true,
    createdAt: new Date('2026-08-15T00:00:00Z'),
    updatedAt: new Date('2026-08-15T00:00:00Z'),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module = await Test.createTestingModule({
      providers: [
        CreateEntranceUseCase,
        { provide: ENTRANCE_REPOSITORY, useValue: entranceRepoMock },
      ],
    }).compile();
    useCase = module.get(CreateEntranceUseCase);
  });

  it('cria a portaria na empresa da sessão', async () => {
    entranceRepoMock.create.mockResolvedValue(createdEntrance);

    const result = await useCase.execute(
      actor,
      new CreateEntranceInputDto('Portaria Principal'),
    );

    expect(entranceRepoMock.create).toHaveBeenCalledWith({
      companyId: actor.companyId,
      name: 'Portaria Principal',
    });
    expect(result).toEqual({
      id: createdEntrance.id,
      name: 'Portaria Principal',
      isActive: true,
    });
  });
});
