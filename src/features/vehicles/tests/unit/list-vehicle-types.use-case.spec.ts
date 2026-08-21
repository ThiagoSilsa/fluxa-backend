// NestJS
import { Test } from '@nestjs/testing';

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
import { ListVehicleTypesInputDto } from '../../application/dto/list-vehicle-types-input.dto';

// Use case
import { ListVehicleTypesUseCase } from '../../application/use-cases/list-vehicle-types.use-case';

describe('ListVehicleTypesUseCase', () => {
  let useCase: ListVehicleTypesUseCase;

  const vehicleTypeRepoMock = {
    list: jest.fn(),
  } as jest.Mocked<Pick<VehicleTypeRepository, 'list'>>;

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

  const types: VehicleTypeEntity[] = [
    {
      id: '40000000-0000-0000-0000-000000000001',
      companyId: actor.companyId,
      code: 'FROTA',
      name: 'Frota',
      description: null,
      isFleet: true,
      isActive: true,
      createdAt: new Date('2026-08-15T00:00:00Z'),
      updatedAt: new Date('2026-08-15T00:00:00Z'),
    },
    {
      id: '40000000-0000-0000-0000-000000000002',
      companyId: actor.companyId,
      code: 'PARTICULAR',
      name: 'Particular',
      description: null,
      isFleet: false,
      isActive: true,
      createdAt: new Date('2026-08-15T00:00:00Z'),
      updatedAt: new Date('2026-08-15T00:00:00Z'),
    },
  ];

  beforeEach(async () => {
    jest.clearAllMocks();
    const module = await Test.createTestingModule({
      providers: [
        ListVehicleTypesUseCase,
        { provide: VEHICLE_TYPE_REPOSITORY, useValue: vehicleTypeRepoMock },
      ],
    }).compile();
    useCase = module.get(ListVehicleTypesUseCase);
  });

  it('lista tipos da empresa com paginação no formato padrão', async () => {
    vehicleTypeRepoMock.list.mockResolvedValue({ data: types, count: 2 });

    const result = await useCase.execute(
      actor,
      new ListVehicleTypesInputDto(undefined, undefined, undefined, 20, 0),
    );

    expect(vehicleTypeRepoMock.list).toHaveBeenCalledWith(actor.companyId, {
      search: undefined,
      isFleet: undefined,
      isActive: undefined,
      limit: 20,
      offset: 0,
    });
    expect(result).toEqual({
      limit: 20,
      offset: 0,
      count: 2,
      data: types.map((type) => ({
        id: type.id,
        code: type.code,
        name: type.name,
        description: type.description,
        isFleet: type.isFleet,
        isActive: type.isActive,
      })),
    });
  });

  it('repassa busca e filtros para o repositório', async () => {
    vehicleTypeRepoMock.list.mockResolvedValue({ data: [], count: 0 });

    await useCase.execute(
      actor,
      new ListVehicleTypesInputDto('FRO', true, true, 10, 5),
    );

    expect(vehicleTypeRepoMock.list).toHaveBeenCalledWith(actor.companyId, {
      search: 'FRO',
      isFleet: true,
      isActive: true,
      limit: 10,
      offset: 5,
    });
  });
});
