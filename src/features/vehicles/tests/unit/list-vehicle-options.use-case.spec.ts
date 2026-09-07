// NestJS
import { Test } from '@nestjs/testing';

// Shared
import { PermissionCode } from '../../../../shared/constants/access-control.constant';

// Constants
import { UserType } from '../../../auth/domain/constants/user-type.constant';

// Types
import type { AuthenticatedUserEntity } from '../../../auth/domain/entities/authenticated-user.entity';
import type { VehicleRepository } from '../../domain/repositories/vehicle.repository';
import type { VehicleWithTypeEntity } from '../../domain/entities/vehicle.entity';

// Repository
import { VEHICLE_REPOSITORY } from '../../domain/repositories/vehicle.repository';

// DTO
import { ListVehicleOptionsInputDto } from '../../application/dto/list-vehicle-options-input.dto';

// Use case
import { ListVehicleOptionsUseCase } from '../../application/use-cases/list-vehicle-options.use-case';

describe('ListVehicleOptionsUseCase', () => {
  let useCase: ListVehicleOptionsUseCase;

  const vehicleRepoMock = {
    list: jest.fn(),
  } as jest.Mocked<Pick<VehicleRepository, 'list'>>;

  const actor: AuthenticatedUserEntity = {
    id: '30000000-0000-0000-0000-000000000001',
    companyId: '10000000-0000-0000-0000-000000000001',
    email: 'porteiro@somar.local',
    name: 'Porteiro',
    type: UserType.EMPLOYEE,
    isAdmin: false,
    roleCodes: ['Portaria'],
    permissions: [PermissionCode.CREATE_ACCESS_REQUEST],
  };

  const row = (
    id: string,
    plate: string,
    model: string | null,
  ): VehicleWithTypeEntity => ({
    id,
    plate,
    companyId: actor.companyId,
    model,
    color: null,
    observation: null,
    isBlocked: false,
    freePass: false,
    vehicleTypeId: '20000000-0000-0000-0000-000000000001',
    isActive: true,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    vehicleType: null,
  });

  beforeEach(async () => {
    jest.clearAllMocks();
    const module = await Test.createTestingModule({
      providers: [
        ListVehicleOptionsUseCase,
        { provide: VEHICLE_REPOSITORY, useValue: vehicleRepoMock },
      ],
    }).compile();
    useCase = module.get(ListVehicleOptionsUseCase);
  });

  it('lista opções enxutas { id, plate, model } da empresa do ator', async () => {
    vehicleRepoMock.list.mockResolvedValue({
      data: [
        row('40000000-0000-0000-0000-000000000001', 'ABC1D23', 'Gol'),
        row('40000000-0000-0000-0000-000000000002', 'XYZ9Z99', null),
      ],
      count: 2,
    });

    const result = await useCase.execute(
      actor,
      new ListVehicleOptionsInputDto(undefined, 20, 0),
    );

    expect(vehicleRepoMock.list).toHaveBeenCalledWith(actor.companyId, {
      search: undefined,
      limit: 20,
      offset: 0,
    });
    expect(result).toEqual({
      limit: 20,
      offset: 0,
      count: 2,
      data: [
        {
          id: '40000000-0000-0000-0000-000000000001',
          plate: 'ABC1D23',
          model: 'Gol',
        },
        {
          id: '40000000-0000-0000-0000-000000000002',
          plate: 'XYZ9Z99',
          model: null,
        },
      ],
    });
  });

  it('repassa busca e paginação para o repositório', async () => {
    vehicleRepoMock.list.mockResolvedValue({ data: [], count: 0 });

    await useCase.execute(actor, new ListVehicleOptionsInputDto('ABC', 10, 20));

    expect(vehicleRepoMock.list).toHaveBeenCalledWith(actor.companyId, {
      search: 'ABC',
      limit: 10,
      offset: 20,
    });
  });
});
