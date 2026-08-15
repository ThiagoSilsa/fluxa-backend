// NestJS
import { ConflictException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { QueryFailedError } from 'typeorm';

// Shared
import { PermissionCode } from '../../../../shared/constants/access-control.constant';

// Constants
import { UserType } from '../../../auth/domain/constants/user-type.constant';

// Types
import type { AuthenticatedUserEntity } from '../../../auth/domain/entities/authenticated-user.entity';
import type { VehicleTypeEntity } from '../../domain/entities/vehicle-type.entity';
import type { VehicleTypeRepository } from '../../domain/repositories/vehicle-type.repository';

// Repository
import { VEHICLE_TYPE_REPOSITORY } from '../../domain/repositories/vehicle-type.repository';

// DTO
import { CreateVehicleTypeInputDto } from '../../application/dto/create-vehicle-type-input.dto';

// Use case
import { CreateVehicleTypeUseCase } from '../../application/use-cases/create-vehicle-type.use-case';

describe('CreateVehicleTypeUseCase', () => {
  let useCase: CreateVehicleTypeUseCase;

  const vehicleTypeRepoMock = {
    create: jest.fn(),
  } as jest.Mocked<Pick<VehicleTypeRepository, 'create'>>;

  const actor: AuthenticatedUserEntity = {
    id: '30000000-0000-0000-0000-000000000001',
    companyId: '10000000-0000-0000-0000-000000000001',
    email: 'admin@somar.local',
    name: 'Administrador',
    type: UserType.EMPLOYEE,
    isAdmin: true,
    roleCodes: ['Administração'],
    permissions: [PermissionCode.MANAGE_VEHICLE_TYPES],
  };

  const createdType: VehicleTypeEntity = {
    id: '40000000-0000-0000-0000-000000000001',
    companyId: actor.companyId,
    code: 'FROTA',
    name: 'Frota',
    description: null,
    isFleet: true,
    isActive: true,
    createdAt: new Date('2026-08-15T00:00:00Z'),
    updatedAt: new Date('2026-08-15T00:00:00Z'),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module = await Test.createTestingModule({
      providers: [
        CreateVehicleTypeUseCase,
        { provide: VEHICLE_TYPE_REPOSITORY, useValue: vehicleTypeRepoMock },
      ],
    }).compile();
    useCase = module.get(CreateVehicleTypeUseCase);
  });

  it('cria o tipo na empresa da sessão com code normalizado (uppercase)', async () => {
    vehicleTypeRepoMock.create.mockResolvedValue(createdType);

    const result = await useCase.execute(
      actor,
      new CreateVehicleTypeInputDto(' frota ', 'Frota', true),
    );

    expect(vehicleTypeRepoMock.create).toHaveBeenCalledWith({
      companyId: actor.companyId,
      code: 'FROTA',
      name: 'Frota',
      description: null,
      isFleet: true,
    });
    expect(result).toMatchObject({
      id: createdType.id,
      code: 'FROTA',
      name: 'Frota',
      isFleet: true,
      isActive: true,
    });
  });

  it('usa isFleet false por padrão e mantém a descrição', async () => {
    vehicleTypeRepoMock.create.mockResolvedValue({
      ...createdType,
      isFleet: false,
      description: 'Particulares',
    });

    await useCase.execute(
      actor,
      new CreateVehicleTypeInputDto(
        'PARTICULAR',
        'Particular',
        false,
        'Particulares',
      ),
    );

    expect(vehicleTypeRepoMock.create).toHaveBeenCalledWith({
      companyId: actor.companyId,
      code: 'PARTICULAR',
      name: 'Particular',
      description: 'Particulares',
      isFleet: false,
    });
  });

  it('traduz violação de unique em ConflictException (409 — ADR 0006 §12)', async () => {
    vehicleTypeRepoMock.create.mockRejectedValue(
      new QueryFailedError('duplicate', [], new Error('23505')),
    );

    await expect(
      useCase.execute(actor, new CreateVehicleTypeInputDto('FROTA', 'Frota')),
    ).rejects.toThrow(ConflictException);
  });
});
