// NestJS
import { ConflictException, NotFoundException } from '@nestjs/common';
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
import { DeleteEntranceUseCase } from '../../application/use-cases/delete-entrance.use-case';

describe('DeleteEntranceUseCase', () => {
  let useCase: DeleteEntranceUseCase;

  const entranceRepoMock = {
    findByIdAndCompanyId: jest.fn(),
    countDevicesByEntranceIdAndCompanyId: jest.fn(),
    deleteByIdAndCompanyId: jest.fn(),
  } as jest.Mocked<
    Pick<
      EntranceRepository,
      | 'findByIdAndCompanyId'
      | 'countDevicesByEntranceIdAndCompanyId'
      | 'deleteByIdAndCompanyId'
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
        DeleteEntranceUseCase,
        { provide: ENTRANCE_REPOSITORY, useValue: entranceRepoMock },
      ],
    }).compile();
    useCase = module.get(DeleteEntranceUseCase);
  });

  it('exclui fisicamente uma portaria sem dispositivos da empresa do ator', async () => {
    entranceRepoMock.findByIdAndCompanyId.mockResolvedValue(existing);
    entranceRepoMock.countDevicesByEntranceIdAndCompanyId.mockResolvedValue(0);
    entranceRepoMock.deleteByIdAndCompanyId.mockResolvedValue(existing);

    await expect(
      useCase.execute(actor, new GetEntranceInputDto(existing.id)),
    ).resolves.toBeUndefined();

    expect(
      entranceRepoMock.countDevicesByEntranceIdAndCompanyId,
    ).toHaveBeenCalledWith(existing.id, actor.companyId);
    expect(entranceRepoMock.deleteByIdAndCompanyId).toHaveBeenCalledWith(
      existing.id,
      actor.companyId,
    );
  });

  it('lança ConflictException (409) quando há dispositivos vinculados à portaria', async () => {
    entranceRepoMock.findByIdAndCompanyId.mockResolvedValue(existing);
    entranceRepoMock.countDevicesByEntranceIdAndCompanyId.mockResolvedValue(2);

    await expect(
      useCase.execute(actor, new GetEntranceInputDto(existing.id)),
    ).rejects.toThrow(ConflictException);
    expect(entranceRepoMock.deleteByIdAndCompanyId).not.toHaveBeenCalled();
  });

  it('lança NotFoundException quando a portaria não existe na empresa', async () => {
    entranceRepoMock.findByIdAndCompanyId.mockResolvedValue(null);

    await expect(
      useCase.execute(
        actor,
        new GetEntranceInputDto('40000000-0000-0000-0000-000000000099'),
      ),
    ).rejects.toThrow(NotFoundException);
    expect(
      entranceRepoMock.countDevicesByEntranceIdAndCompanyId,
    ).not.toHaveBeenCalled();
    expect(entranceRepoMock.deleteByIdAndCompanyId).not.toHaveBeenCalled();
  });

  it('lança NotFoundException quando a exclusão não encontra a portaria', async () => {
    entranceRepoMock.findByIdAndCompanyId.mockResolvedValue(existing);
    entranceRepoMock.countDevicesByEntranceIdAndCompanyId.mockResolvedValue(0);
    entranceRepoMock.deleteByIdAndCompanyId.mockResolvedValue(null);

    await expect(
      useCase.execute(actor, new GetEntranceInputDto(existing.id)),
    ).rejects.toThrow(NotFoundException);
  });
});
