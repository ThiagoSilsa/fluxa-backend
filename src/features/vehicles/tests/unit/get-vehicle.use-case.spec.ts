// NestJS
import { NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';

// Shared
import { PermissionCode } from '../../../../shared/constants/access-control.constant';

// Constants
import { UserType } from '../../../auth/domain/constants/user-type.constant';

// Types
import type { AuthenticatedUserEntity } from '../../../auth/domain/entities/authenticated-user.entity';
import type { VehicleWithTypeEntity } from '../../domain/entities/vehicle.entity';
import type { VehicleRepository } from '../../domain/repositories/vehicle.repository';

// Repository
import { VEHICLE_REPOSITORY } from '../../domain/repositories/vehicle.repository';

// DTO
import { GetVehicleInputDto } from '../../application/dto/get-vehicle-input.dto';

// Use case
import { GetVehicleUseCase } from '../../application/use-cases/get-vehicle.use-case';

describe('GetVehicleUseCase', () => {
  let useCase: GetVehicleUseCase;

  const vehicleRepoMock = {
    findByIdAndCompanyId: jest.fn(),
  } as jest.Mocked<Pick<VehicleRepository, 'findByIdAndCompanyId'>>;

  const actor: AuthenticatedUserEntity = {
    id: '30000000-0000-0000-0000-000000000001',
    companyId: '10000000-0000-0000-0000-000000000001',
    email: 'admin@somar.local',
    name: 'Administrador',
    type: UserType.EMPLOYEE,
    isAdmin: true,
    roleCodes: ['Administração'],
    permissions: [PermissionCode.MANAGE_VEHICLES],
  };

  const vehicle: VehicleWithTypeEntity = {
    id: '50000000-0000-0000-0000-000000000001',
    plate: 'ABC1D23',
    companyId: actor.companyId,
    model: 'Onix',
    color: 'Prata',
    observation: null,
    isBlocked: false,
    freePass: false,
    vehicleTypeId: '40000000-0000-0000-0000-000000000001',
    vehicleType: {
      id: '40000000-0000-0000-0000-000000000001',
      code: 'FROTA',
      name: 'Frota',
      isFleet: true,
    },
    isActive: true,
    createdAt: new Date('2026-08-15T00:00:00Z'),
    updatedAt: new Date('2026-08-15T00:00:00Z'),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module = await Test.createTestingModule({
      providers: [
        GetVehicleUseCase,
        { provide: VEHICLE_REPOSITORY, useValue: vehicleRepoMock },
      ],
    }).compile();
    useCase = module.get(GetVehicleUseCase);
  });

  it('detalha um veículo da empresa do ator com o tipo', async () => {
    vehicleRepoMock.findByIdAndCompanyId.mockResolvedValue(vehicle);

    const result = await useCase.execute(
      actor,
      new GetVehicleInputDto(vehicle.id),
    );

    expect(vehicleRepoMock.findByIdAndCompanyId).toHaveBeenCalledWith(
      vehicle.id,
      actor.companyId,
    );
    expect(result).toMatchObject({
      id: vehicle.id,
      plate: 'ABC1D23',
      vehicleType: { code: 'FROTA' },
    });
  });

  it('lança NotFoundException quando o veículo não existe na empresa (cross-tenant incluso)', async () => {
    vehicleRepoMock.findByIdAndCompanyId.mockResolvedValue(null);

    await expect(
      useCase.execute(
        actor,
        new GetVehicleInputDto('50000000-0000-0000-0000-000000000099'),
      ),
    ).rejects.toThrow(NotFoundException);
  });
});
