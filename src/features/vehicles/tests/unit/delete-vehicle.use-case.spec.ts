// NestJS
import { ConflictException, NotFoundException } from '@nestjs/common';
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
import { DeleteVehicleUseCase } from '../../application/use-cases/delete-vehicle.use-case';

describe('DeleteVehicleUseCase', () => {
  let useCase: DeleteVehicleUseCase;

  const vehicleRepoMock = {
    findByIdAndCompanyId: jest.fn(),
    countVehicleLinksByVehicleIdAndCompanyId: jest.fn(),
    deleteByIdAndCompanyId: jest.fn(),
  } as jest.Mocked<
    Pick<
      VehicleRepository,
      | 'findByIdAndCompanyId'
      | 'countVehicleLinksByVehicleIdAndCompanyId'
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
    permissions: [PermissionCode.MANAGE_VEHICLES],
  };

  const existing: VehicleWithTypeEntity = {
    id: '50000000-0000-0000-0000-000000000001',
    companyId: actor.companyId,
    plate: 'ABC1D23',
    model: 'Onix',
    color: null,
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
        DeleteVehicleUseCase,
        { provide: VEHICLE_REPOSITORY, useValue: vehicleRepoMock },
      ],
    }).compile();
    useCase = module.get(DeleteVehicleUseCase);
  });

  it('exclui fisicamente um veículo sem vínculos da empresa do ator', async () => {
    vehicleRepoMock.findByIdAndCompanyId.mockResolvedValue(existing);
    vehicleRepoMock.countVehicleLinksByVehicleIdAndCompanyId.mockResolvedValue(
      0,
    );
    vehicleRepoMock.deleteByIdAndCompanyId.mockResolvedValue(existing);

    await expect(
      useCase.execute(actor, new GetVehicleInputDto(existing.id)),
    ).resolves.toBeUndefined();

    expect(
      vehicleRepoMock.countVehicleLinksByVehicleIdAndCompanyId,
    ).toHaveBeenCalledWith(existing.id, actor.companyId);
    expect(vehicleRepoMock.deleteByIdAndCompanyId).toHaveBeenCalledWith(
      existing.id,
      actor.companyId,
    );
  });

  it('lança ConflictException (409) quando há vínculos (departamento padrão ou motoristas)', async () => {
    vehicleRepoMock.findByIdAndCompanyId.mockResolvedValue(existing);
    vehicleRepoMock.countVehicleLinksByVehicleIdAndCompanyId.mockResolvedValue(
      2,
    );

    await expect(
      useCase.execute(actor, new GetVehicleInputDto(existing.id)),
    ).rejects.toThrow(ConflictException);
    expect(vehicleRepoMock.deleteByIdAndCompanyId).not.toHaveBeenCalled();
  });

  it('lança NotFoundException quando o veículo não existe na empresa', async () => {
    vehicleRepoMock.findByIdAndCompanyId.mockResolvedValue(null);

    await expect(
      useCase.execute(
        actor,
        new GetVehicleInputDto('50000000-0000-0000-0000-000000000099'),
      ),
    ).rejects.toThrow(NotFoundException);
    expect(
      vehicleRepoMock.countVehicleLinksByVehicleIdAndCompanyId,
    ).not.toHaveBeenCalled();
    expect(vehicleRepoMock.deleteByIdAndCompanyId).not.toHaveBeenCalled();
  });

  it('lança NotFoundException quando a exclusão não encontra o veículo', async () => {
    vehicleRepoMock.findByIdAndCompanyId.mockResolvedValue(existing);
    vehicleRepoMock.countVehicleLinksByVehicleIdAndCompanyId.mockResolvedValue(
      0,
    );
    vehicleRepoMock.deleteByIdAndCompanyId.mockResolvedValue(null);

    await expect(
      useCase.execute(actor, new GetVehicleInputDto(existing.id)),
    ).rejects.toThrow(NotFoundException);
  });
});
