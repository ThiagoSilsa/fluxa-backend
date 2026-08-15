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
import { DeactivateEntranceUseCase } from '../../application/use-cases/deactivate-entrance.use-case';

describe('DeactivateEntranceUseCase', () => {
  let useCase: DeactivateEntranceUseCase;

  const entranceRepoMock = {
    findByIdAndCompanyId: jest.fn(),
    deactivateByIdAndCompanyId: jest.fn(),
  } as jest.Mocked<
    Pick<
      EntranceRepository,
      'findByIdAndCompanyId' | 'deactivateByIdAndCompanyId'
    >
  >;

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

  const existing: EntranceEntity = {
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
        DeactivateEntranceUseCase,
        { provide: ENTRANCE_REPOSITORY, useValue: entranceRepoMock },
      ],
    }).compile();
    useCase = module.get(DeactivateEntranceUseCase);
  });

  it('desativa (soft) uma portaria da empresa do ator', async () => {
    entranceRepoMock.findByIdAndCompanyId.mockResolvedValue(existing);
    entranceRepoMock.deactivateByIdAndCompanyId.mockResolvedValue({
      ...existing,
      isActive: false,
    });

    const result = await useCase.execute(
      actor,
      new GetEntranceInputDto(existing.id),
    );

    expect(entranceRepoMock.deactivateByIdAndCompanyId).toHaveBeenCalledWith(
      existing.id,
      actor.companyId,
    );
    expect(result.isActive).toBe(false);
  });

  it('lança NotFoundException quando a portaria não existe na empresa', async () => {
    entranceRepoMock.findByIdAndCompanyId.mockResolvedValue(null);

    await expect(
      useCase.execute(
        actor,
        new GetEntranceInputDto('40000000-0000-0000-0000-000000000099'),
      ),
    ).rejects.toThrow(NotFoundException);
    expect(entranceRepoMock.deactivateByIdAndCompanyId).not.toHaveBeenCalled();
  });
});
