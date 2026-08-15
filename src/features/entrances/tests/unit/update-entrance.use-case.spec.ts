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
import { UpdateEntranceInputDto } from '../../application/dto/update-entrance-input.dto';

// Use case
import { UpdateEntranceUseCase } from '../../application/use-cases/update-entrance.use-case';

describe('UpdateEntranceUseCase', () => {
  let useCase: UpdateEntranceUseCase;

  const entranceRepoMock = {
    findByIdAndCompanyId: jest.fn(),
    updateByIdAndCompanyId: jest.fn(),
  } as jest.Mocked<
    Pick<EntranceRepository, 'findByIdAndCompanyId' | 'updateByIdAndCompanyId'>
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
        UpdateEntranceUseCase,
        { provide: ENTRANCE_REPOSITORY, useValue: entranceRepoMock },
      ],
    }).compile();
    useCase = module.get(UpdateEntranceUseCase);
  });

  it('atualiza o nome da portaria (PATCH parcial)', async () => {
    entranceRepoMock.findByIdAndCompanyId.mockResolvedValue(existing);
    entranceRepoMock.updateByIdAndCompanyId.mockResolvedValue({
      ...existing,
      name: 'Portaria Secundária',
    });

    const result = await useCase.execute(
      actor,
      new UpdateEntranceInputDto(existing.id, 'Portaria Secundária'),
    );

    expect(entranceRepoMock.updateByIdAndCompanyId).toHaveBeenCalledWith(
      existing.id,
      actor.companyId,
      { name: 'Portaria Secundária', isActive: undefined },
    );
    expect(result).toMatchObject({ name: 'Portaria Secundária' });
  });

  it('reativa uma portaria via PATCH com isActive true (ADR 0006 §2)', async () => {
    entranceRepoMock.findByIdAndCompanyId.mockResolvedValue({
      ...existing,
      isActive: false,
    });
    entranceRepoMock.updateByIdAndCompanyId.mockResolvedValue({
      ...existing,
      isActive: true,
    });

    const result = await useCase.execute(
      actor,
      new UpdateEntranceInputDto(existing.id, undefined, true),
    );

    expect(entranceRepoMock.updateByIdAndCompanyId).toHaveBeenCalledWith(
      existing.id,
      actor.companyId,
      { name: undefined, isActive: true },
    );
    expect(result.isActive).toBe(true);
  });

  it('lança NotFoundException quando a portaria não existe na empresa', async () => {
    entranceRepoMock.findByIdAndCompanyId.mockResolvedValue(null);

    await expect(
      useCase.execute(
        actor,
        new UpdateEntranceInputDto(
          '40000000-0000-0000-0000-000000000099',
          'Outra',
        ),
      ),
    ).rejects.toThrow(NotFoundException);
    expect(entranceRepoMock.updateByIdAndCompanyId).not.toHaveBeenCalled();
  });
});
