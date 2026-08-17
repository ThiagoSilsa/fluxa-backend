// NestJS
import { ConflictException, NotFoundException } from '@nestjs/common';
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
import { GetVehicleTypeInputDto } from '../../application/dto/get-vehicle-type-input.dto';

// Use case
import { DeleteVehicleTypeUseCase } from '../../application/use-cases/delete-vehicle-type.use-case';

describe('DeleteVehicleTypeUseCase', () => {
  let useCase: DeleteVehicleTypeUseCase;

  const vehicleTypeRepoMock = {
    findByIdAndCompanyId: jest.fn(),
    countVehiclesByTypeIdAndCompanyId: jest.fn(),
    deleteByIdAndCompanyId: jest.fn(),
  } as jest.Mocked<
    Pick<
      VehicleTypeRepository,
      | 'findByIdAndCompanyId'
      | 'countVehiclesByTypeIdAndCompanyId'
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
    permissions: [PermissionCode.MANAGE_VEHICLE_TYPES],
  };

  const existing: VehicleTypeEntity = {
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
        DeleteVehicleTypeUseCase,
        { provide: VEHICLE_TYPE_REPOSITORY, useValue: vehicleTypeRepoMock },
      ],
    }).compile();
    useCase = module.get(DeleteVehicleTypeUseCase);
  });

  it('exclui fisicamente um tipo sem veículos da empresa do ator', async () => {
    vehicleTypeRepoMock.findByIdAndCompanyId.mockResolvedValue(existing);
    vehicleTypeRepoMock.countVehiclesByTypeIdAndCompanyId.mockResolvedValue(0);
    vehicleTypeRepoMock.deleteByIdAndCompanyId.mockResolvedValue(existing);

    await expect(
      useCase.execute(actor, new GetVehicleTypeInputDto(existing.id)),
    ).resolves.toBeUndefined();

    expect(
      vehicleTypeRepoMock.countVehiclesByTypeIdAndCompanyId,
    ).toHaveBeenCalledWith(existing.id, actor.companyId);
    expect(vehicleTypeRepoMock.deleteByIdAndCompanyId).toHaveBeenCalledWith(
      existing.id,
      actor.companyId,
    );
  });

  it('lança ConflictException (409) quando há veículos usando o tipo', async () => {
    vehicleTypeRepoMock.findByIdAndCompanyId.mockResolvedValue(existing);
    vehicleTypeRepoMock.countVehiclesByTypeIdAndCompanyId.mockResolvedValue(2);

    await expect(
      useCase.execute(actor, new GetVehicleTypeInputDto(existing.id)),
    ).rejects.toThrow(ConflictException);
    expect(vehicleTypeRepoMock.deleteByIdAndCompanyId).not.toHaveBeenCalled();
  });

  it('lança NotFoundException quando o tipo não existe na empresa', async () => {
    vehicleTypeRepoMock.findByIdAndCompanyId.mockResolvedValue(null);

    await expect(
      useCase.execute(
        actor,
        new GetVehicleTypeInputDto('40000000-0000-0000-0000-000000000099'),
      ),
    ).rejects.toThrow(NotFoundException);
    expect(
      vehicleTypeRepoMock.countVehiclesByTypeIdAndCompanyId,
    ).not.toHaveBeenCalled();
    expect(vehicleTypeRepoMock.deleteByIdAndCompanyId).not.toHaveBeenCalled();
  });

  it('lança NotFoundException quando a exclusão não encontra o tipo', async () => {
    vehicleTypeRepoMock.findByIdAndCompanyId.mockResolvedValue(existing);
    vehicleTypeRepoMock.countVehiclesByTypeIdAndCompanyId.mockResolvedValue(0);
    vehicleTypeRepoMock.deleteByIdAndCompanyId.mockResolvedValue(null);

    await expect(
      useCase.execute(actor, new GetVehicleTypeInputDto(existing.id)),
    ).rejects.toThrow(NotFoundException);
  });
});
