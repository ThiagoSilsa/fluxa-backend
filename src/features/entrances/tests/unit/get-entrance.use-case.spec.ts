// NestJS
import { NotFoundException } from '@nestjs/common';
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
import { GetEntranceInputDto } from '../../application/dto/get-entrance-input.dto';

// Use case
import { GetEntranceUseCase } from '../../application/use-cases/get-entrance.use-case';

describe('GetEntranceUseCase', () => {
  let useCase: GetEntranceUseCase;

  const entranceRepoMock = {
    findByIdAndCompanyId: jest.fn(),
  } as jest.Mocked<Pick<EntranceRepository, 'findByIdAndCompanyId'>>;

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

  const entrance: EntranceEntity = {
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
        GetEntranceUseCase,
        { provide: ENTRANCE_REPOSITORY, useValue: entranceRepoMock },
      ],
    }).compile();
    useCase = module.get(GetEntranceUseCase);
  });

  it('detalha uma portaria da empresa do ator', async () => {
    entranceRepoMock.findByIdAndCompanyId.mockResolvedValue(entrance);

    const result = await useCase.execute(
      actor,
      new GetEntranceInputDto(entrance.id),
    );

    expect(entranceRepoMock.findByIdAndCompanyId).toHaveBeenCalledWith(
      entrance.id,
      actor.companyId,
    );
    expect(result).toEqual({
      id: entrance.id,
      name: 'Portaria Principal',
      isActive: true,
    });
  });

  it('lança NotFoundException quando a portaria não existe na empresa (cross-tenant incluso)', async () => {
    entranceRepoMock.findByIdAndCompanyId.mockResolvedValue(null);

    await expect(
      useCase.execute(
        actor,
        new GetEntranceInputDto('40000000-0000-0000-0000-000000000099'),
      ),
    ).rejects.toThrow(NotFoundException);
  });
});
