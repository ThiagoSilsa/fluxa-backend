// NestJS
import { ConflictException, NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { QueryFailedError } from 'typeorm';

// Shared
import { PermissionCode } from '../../../../shared/constants/access-control.constant';

// Constants
import { UserType } from '../../../auth/domain/constants/user-type.constant';

// Types
import type { AuthenticatedUserEntity } from '../../../auth/domain/entities/authenticated-user.entity';
import type { UserCompanyRepository } from '../../../auth/domain/repositories/user-company.repository';
import type { UserVehicleWithUserEntity } from '../../domain/entities/user-vehicle.entity';
import type { VehicleWithTypeEntity } from '../../domain/entities/vehicle.entity';
import type { UserVehicleRepository } from '../../domain/repositories/user-vehicle.repository';
import type { VehicleRepository } from '../../domain/repositories/vehicle.repository';

// Repositories
import { USER_COMPANY_REPOSITORY } from '../../../auth/domain/repositories/user-company.repository';
import { USER_VEHICLE_REPOSITORY } from '../../domain/repositories/user-vehicle.repository';
import { VEHICLE_REPOSITORY } from '../../domain/repositories/vehicle.repository';

// DTO
import { AssignDriverInputDto } from '../../application/dto/assign-driver-input.dto';

// Use case
import { AssignDriverToVehicleUseCase } from '../../application/use-cases/assign-driver-to-vehicle.use-case';

describe('AssignDriverToVehicleUseCase', () => {
  let useCase: AssignDriverToVehicleUseCase;

  const vehicleRepoMock = {
    findByIdAndCompanyId: jest.fn(),
  } as jest.Mocked<Pick<VehicleRepository, 'findByIdAndCompanyId'>>;

  const userVehicleRepoMock = {
    create: jest.fn(),
    findByUserIdAndVehicleIdAndCompanyId: jest.fn(),
  } as jest.Mocked<
    Pick<
      UserVehicleRepository,
      'create' | 'findByUserIdAndVehicleIdAndCompanyId'
    >
  >;

  const userCompanyRepoMock = {
    existsActive: jest.fn(),
  } as jest.Mocked<Pick<UserCompanyRepository, 'existsActive'>>;

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

  const vehicleId = '50000000-0000-0000-0000-000000000001';
  const userId = '30000000-0000-0000-0000-000000000002';

  const vehicle: VehicleWithTypeEntity = {
    id: vehicleId,
    plate: 'ABC1D23',
    companyId: actor.companyId,
    model: null,
    color: null,
    observation: null,
    isBlocked: false,
    freePass: false,
    vehicleTypeId: '40000000-0000-0000-0000-000000000001',
    vehicleType: null,
    isActive: true,
    createdAt: new Date('2026-08-15T00:00:00Z'),
    updatedAt: new Date('2026-08-15T00:00:00Z'),
  };

  const created: UserVehicleWithUserEntity = {
    id: '60000000-0000-0000-0000-000000000001',
    companyId: actor.companyId,
    userId,
    vehicleId,
    isPrimary: true,
    canDrive: true,
    createdAt: new Date('2026-08-15T00:00:00Z'),
    updatedAt: new Date('2026-08-15T00:00:00Z'),
    user: { id: userId, name: 'Motorista' },
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module = await Test.createTestingModule({
      providers: [
        AssignDriverToVehicleUseCase,
        { provide: VEHICLE_REPOSITORY, useValue: vehicleRepoMock },
        { provide: USER_VEHICLE_REPOSITORY, useValue: userVehicleRepoMock },
        { provide: USER_COMPANY_REPOSITORY, useValue: userCompanyRepoMock },
      ],
    }).compile();
    useCase = module.get(AssignDriverToVehicleUseCase);
  });

  it('vincula o motorista (is_primary substitui o anterior — transação no repo)', async () => {
    vehicleRepoMock.findByIdAndCompanyId.mockResolvedValue(vehicle);
    userCompanyRepoMock.existsActive.mockResolvedValue(true);
    userVehicleRepoMock.findByUserIdAndVehicleIdAndCompanyId
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(created);
    userVehicleRepoMock.create.mockResolvedValue(created);

    const result = await useCase.execute(
      actor,
      new AssignDriverInputDto(vehicleId, userId, true),
    );

    expect(userCompanyRepoMock.existsActive).toHaveBeenCalledWith(
      userId,
      actor.companyId,
    );
    expect(userVehicleRepoMock.create).toHaveBeenCalledWith({
      companyId: actor.companyId,
      userId,
      vehicleId,
      isPrimary: true,
      canDrive: true,
    });
    expect(result).toMatchObject({
      id: created.id,
      user: { id: userId, name: 'Motorista' },
      isPrimary: true,
      canDrive: true,
    });
  });

  it('usa defaults isPrimary=false e canDrive=true quando omitidos', async () => {
    vehicleRepoMock.findByIdAndCompanyId.mockResolvedValue(vehicle);
    userCompanyRepoMock.existsActive.mockResolvedValue(true);
    userVehicleRepoMock.findByUserIdAndVehicleIdAndCompanyId
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ ...created, isPrimary: false });
    userVehicleRepoMock.create.mockResolvedValue({
      ...created,
      isPrimary: false,
    });

    await useCase.execute(actor, new AssignDriverInputDto(vehicleId, userId));

    expect(userVehicleRepoMock.create).toHaveBeenCalledWith({
      companyId: actor.companyId,
      userId,
      vehicleId,
      isPrimary: false,
      canDrive: true,
    });
  });

  it('lança NotFoundException quando o veículo não existe na empresa', async () => {
    vehicleRepoMock.findByIdAndCompanyId.mockResolvedValue(null);

    await expect(
      useCase.execute(actor, new AssignDriverInputDto(vehicleId, userId)),
    ).rejects.toThrow(NotFoundException);
    expect(userVehicleRepoMock.create).not.toHaveBeenCalled();
  });

  it('lança NotFoundException quando o motorista não tem vínculo ativo (404)', async () => {
    vehicleRepoMock.findByIdAndCompanyId.mockResolvedValue(vehicle);
    userCompanyRepoMock.existsActive.mockResolvedValue(false);

    await expect(
      useCase.execute(actor, new AssignDriverInputDto(vehicleId, userId)),
    ).rejects.toThrow(NotFoundException);
    expect(userVehicleRepoMock.create).not.toHaveBeenCalled();
  });

  it('lança ConflictException quando o vínculo já existe (409)', async () => {
    vehicleRepoMock.findByIdAndCompanyId.mockResolvedValue(vehicle);
    userCompanyRepoMock.existsActive.mockResolvedValue(true);
    userVehicleRepoMock.findByUserIdAndVehicleIdAndCompanyId.mockResolvedValue(
      created,
    );

    await expect(
      useCase.execute(actor, new AssignDriverInputDto(vehicleId, userId)),
    ).rejects.toThrow(ConflictException);
    expect(userVehicleRepoMock.create).not.toHaveBeenCalled();
  });

  it('traduz violação de unique em ConflictException (409 — concorrência)', async () => {
    vehicleRepoMock.findByIdAndCompanyId.mockResolvedValue(vehicle);
    userCompanyRepoMock.existsActive.mockResolvedValue(true);
    userVehicleRepoMock.findByUserIdAndVehicleIdAndCompanyId.mockResolvedValue(
      null,
    );
    userVehicleRepoMock.create.mockRejectedValue(
      new QueryFailedError('duplicate', [], new Error('23505')),
    );

    await expect(
      useCase.execute(actor, new AssignDriverInputDto(vehicleId, userId)),
    ).rejects.toThrow(ConflictException);
  });
});
