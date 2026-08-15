// NestJS
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';

// Shared
import { PermissionCode } from '../../../../shared/constants/access-control.constant';

// Constants
import { UserType } from '../../../auth/domain/constants/user-type.constant';

// Types
import type { AuthenticatedUserEntity } from '../../../auth/domain/entities/authenticated-user.entity';
import type { RoleEntity } from '../../domain/entities/role.entity';
import type { RoleRepository } from '../../domain/repositories/role.repository';

// Repository
import { ROLE_REPOSITORY } from '../../domain/repositories/role.repository';

// DTO
import { GetRoleInputDto } from '../../application/dto/get-role-input.dto';

// Use case
import { DeactivateRoleUseCase } from '../../application/use-cases/deactivate-role.use-case';

describe('DeactivateRoleUseCase', () => {
  let useCase: DeactivateRoleUseCase;

  const roleRepoMock = {
    findByIdAndCompanyId: jest.fn(),
    deactivateByIdAndCompanyId: jest.fn(),
  } as jest.Mocked<
    Pick<RoleRepository, 'findByIdAndCompanyId' | 'deactivateByIdAndCompanyId'>
  >;

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

  const role: RoleEntity = {
    id: '40000000-0000-0000-0000-000000000001',
    companyId: actor.companyId,
    name: 'Porteiro',
    description: null,
    isAdmin: false,
    isActive: true,
    createdAt: new Date('2026-08-15T00:00:00Z'),
    updatedAt: new Date('2026-08-15T00:00:00Z'),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module = await Test.createTestingModule({
      providers: [
        DeactivateRoleUseCase,
        { provide: ROLE_REPOSITORY, useValue: roleRepoMock },
      ],
    }).compile();
    useCase = module.get(DeactivateRoleUseCase);
  });

  it('desativa o cargo (soft) sem tocar em vínculos', async () => {
    roleRepoMock.findByIdAndCompanyId.mockResolvedValue(role);
    roleRepoMock.deactivateByIdAndCompanyId.mockResolvedValue({
      ...role,
      isActive: false,
    });

    const result = await useCase.execute(actor, new GetRoleInputDto(role.id));

    expect(roleRepoMock.deactivateByIdAndCompanyId).toHaveBeenCalledWith(
      role.id,
      actor.companyId,
    );
    expect(result).toEqual({
      id: role.id,
      name: 'Porteiro',
      description: null,
      isAdmin: false,
      isActive: false,
    });
  });

  it('lança NotFoundException quando o cargo não existe na empresa', async () => {
    roleRepoMock.findByIdAndCompanyId.mockResolvedValue(null);

    await expect(
      useCase.execute(actor, new GetRoleInputDto(role.id)),
    ).rejects.toThrow(NotFoundException);
    expect(roleRepoMock.deactivateByIdAndCompanyId).not.toHaveBeenCalled();
  });

  it('lança BadRequestException para cargo is_admin (imutável — ADR 0004)', async () => {
    roleRepoMock.findByIdAndCompanyId.mockResolvedValue({
      ...role,
      isAdmin: true,
    });

    await expect(
      useCase.execute(actor, new GetRoleInputDto(role.id)),
    ).rejects.toThrow(BadRequestException);
    expect(roleRepoMock.deactivateByIdAndCompanyId).not.toHaveBeenCalled();
  });
});
