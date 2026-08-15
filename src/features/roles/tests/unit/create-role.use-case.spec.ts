// NestJS
import { BadRequestException } from '@nestjs/common';
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
import { CreateRoleInputDto } from '../../application/dto/create-role-input.dto';

// Use case
import { CreateRoleUseCase } from '../../application/use-cases/create-role.use-case';

describe('CreateRoleUseCase', () => {
  let useCase: CreateRoleUseCase;

  const roleRepoMock = {
    create: jest.fn(),
  } as jest.Mocked<Pick<RoleRepository, 'create'>>;

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

  const createdRole: RoleEntity = {
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
        CreateRoleUseCase,
        { provide: ROLE_REPOSITORY, useValue: roleRepoMock },
      ],
    }).compile();
    useCase = module.get(CreateRoleUseCase);
  });

  it('cria o cargo na empresa da sessão com isAdmin false', async () => {
    roleRepoMock.create.mockResolvedValue(createdRole);

    const result = await useCase.execute(
      actor,
      new CreateRoleInputDto('Porteiro'),
    );

    expect(roleRepoMock.create).toHaveBeenCalledWith({
      companyId: actor.companyId,
      name: 'Porteiro',
      description: null,
      isAdmin: false,
    });
    expect(result).toEqual({
      id: createdRole.id,
      name: 'Porteiro',
      description: null,
      isAdmin: false,
      isActive: true,
    });
  });

  it('mantém a descrição informada', async () => {
    roleRepoMock.create.mockResolvedValue({
      ...createdRole,
      description: 'Opera a portaria',
    });

    await useCase.execute(
      actor,
      new CreateRoleInputDto('Porteiro', 'Opera a portaria'),
    );

    expect(roleRepoMock.create).toHaveBeenCalledWith({
      companyId: actor.companyId,
      name: 'Porteiro',
      description: 'Opera a portaria',
      isAdmin: false,
    });
  });

  it('rejeita isAdmin true com BadRequestException (ADR 0004)', async () => {
    await expect(
      useCase.execute(actor, new CreateRoleInputDto('Admin', undefined, true)),
    ).rejects.toThrow(BadRequestException);
    expect(roleRepoMock.create).not.toHaveBeenCalled();
  });
});
