// NestJS
import { GoneException, NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';

// Shared
import { PermissionCode } from '../../../../shared/constants/access-control.constant';

// Constants
import { UserType } from '../../../auth/domain/constants/user-type.constant';

// Types
import type { AuthenticatedUserEntity } from '../../../auth/domain/entities/authenticated-user.entity';
import type { VehicleQrEntity } from '../../domain/entities/vehicle-qr.entity';
import type { VehicleWithTypeEntity } from '../../domain/entities/vehicle.entity';
import type { VehicleQrRepository } from '../../domain/repositories/vehicle-qr.repository';
import type { VehicleRepository } from '../../domain/repositories/vehicle.repository';
import type { VehicleDepartmentRepository } from '../../domain/repositories/vehicle-department.repository';
import type { DepartmentRepository } from '../../../departments/domain/repositories/department.repository';
import type { UserVehicleRepository } from '../../domain/repositories/user-vehicle.repository';

// Repositories
import { VEHICLE_QR_REPOSITORY } from '../../domain/repositories/vehicle-qr.repository';
import { VEHICLE_REPOSITORY } from '../../domain/repositories/vehicle.repository';
import { VEHICLE_DEPARTMENT_REPOSITORY } from '../../domain/repositories/vehicle-department.repository';
import { DEPARTMENT_REPOSITORY } from '../../../departments/domain/repositories/department.repository';
import { USER_VEHICLE_REPOSITORY } from '../../domain/repositories/user-vehicle.repository';

// DTO
import { ResolveVehicleQrInputDto } from '../../application/dto/resolve-vehicle-qr-input.dto';

// Use case
import { ResolveVehicleQrUseCase } from '../../application/use-cases/resolve-vehicle-qr.use-case';

describe('ResolveVehicleQrUseCase', () => {
  let useCase: ResolveVehicleQrUseCase;

  const vehicleQrRepoMock = {
    findByCodeAndCompanyId: jest.fn(),
  } as jest.Mocked<Pick<VehicleQrRepository, 'findByCodeAndCompanyId'>>;

  const vehicleRepoMock = {
    findByIdAndCompanyId: jest.fn(),
  } as jest.Mocked<Pick<VehicleRepository, 'findByIdAndCompanyId'>>;

  const vehicleDepartmentRepoMock = {
    findActiveByVehicleIdAndCompanyId: jest.fn(),
  } as jest.Mocked<
    Pick<VehicleDepartmentRepository, 'findActiveByVehicleIdAndCompanyId'>
  >;

  const departmentRepoMock = {
    findByIdAndCompanyId: jest.fn(),
  } as jest.Mocked<Pick<DepartmentRepository, 'findByIdAndCompanyId'>>;

  const userVehicleRepoMock = {
    findByVehicleIdAndCompanyId: jest.fn(),
  } as jest.Mocked<Pick<UserVehicleRepository, 'findByVehicleIdAndCompanyId'>>;

  const actor: AuthenticatedUserEntity = {
    id: '30000000-0000-0000-0000-000000000002',
    companyId: '10000000-0000-0000-0000-000000000001',
    email: 'porteiro@somar.local',
    name: 'Porteiro',
    type: UserType.EMPLOYEE,
    isAdmin: false,
    roleCodes: ['Porteiro'],
    permissions: [PermissionCode.REGISTER_ENTRY],
  };

  const activeQr: VehicleQrEntity = {
    id: '50000000-0000-0000-0000-000000000010',
    companyId: actor.companyId,
    vehicleId: '40000000-0000-0000-0000-000000000010',
    code: '550e8400-e29b-41d4-a716-446655440000',
    isActive: true,
    issuedBy: null,
    printedAt: null,
    createdAt: new Date('2026-08-21T00:00:00Z'),
    updatedAt: new Date('2026-08-21T00:00:00Z'),
  };

  const revokedQr: VehicleQrEntity = { ...activeQr, isActive: false };

  const vehicle: VehicleWithTypeEntity = {
    id: activeQr.vehicleId,
    plate: 'ABC1D23',
    companyId: actor.companyId,
    model: 'Corolla',
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
        ResolveVehicleQrUseCase,
        { provide: VEHICLE_QR_REPOSITORY, useValue: vehicleQrRepoMock },
        { provide: VEHICLE_REPOSITORY, useValue: vehicleRepoMock },
        {
          provide: VEHICLE_DEPARTMENT_REPOSITORY,
          useValue: vehicleDepartmentRepoMock,
        },
        { provide: DEPARTMENT_REPOSITORY, useValue: departmentRepoMock },
        { provide: USER_VEHICLE_REPOSITORY, useValue: userVehicleRepoMock },
      ],
    }).compile();
    useCase = module.get(ResolveVehicleQrUseCase);
  });

  it('resolve o veículo com tipo, departamento e motoristas', async () => {
    vehicleQrRepoMock.findByCodeAndCompanyId.mockResolvedValue(activeQr);
    vehicleRepoMock.findByIdAndCompanyId.mockResolvedValue(vehicle);
    vehicleDepartmentRepoMock.findActiveByVehicleIdAndCompanyId.mockResolvedValue(
      {
        id: '60000000-0000-0000-0000-000000000001',
        companyId: actor.companyId,
        vehicleId: vehicle.id,
        departmentId: '40000000-0000-0000-0000-000000000002',
        isActive: true,
        createdAt: new Date('2026-08-15T00:00:00Z'),
        updatedAt: new Date('2026-08-15T00:00:00Z'),
      },
    );
    departmentRepoMock.findByIdAndCompanyId.mockResolvedValue({
      id: '40000000-0000-0000-0000-000000000002',
      companyId: actor.companyId,
      name: 'Recepção',
      description: null,
      parkingSpace: 10,
      isActive: true,
      createdAt: new Date('2026-08-15T00:00:00Z'),
      updatedAt: new Date('2026-08-15T00:00:00Z'),
    });
    userVehicleRepoMock.findByVehicleIdAndCompanyId.mockResolvedValue([
      {
        id: '60000000-0000-0000-0000-000000000002',
        companyId: actor.companyId,
        vehicleId: vehicle.id,
        userId: '30000000-0000-0000-0000-000000000003',
        user: { id: '30000000-0000-0000-0000-000000000003', name: 'Maria' },
        isPrimary: true,
        canDrive: true,
        createdAt: new Date('2026-08-15T00:00:00Z'),
        updatedAt: new Date('2026-08-15T00:00:00Z'),
      },
    ]);

    const result = await useCase.execute(
      actor,
      new ResolveVehicleQrInputDto(activeQr.code),
    );

    expect(vehicleQrRepoMock.findByCodeAndCompanyId).toHaveBeenCalledWith(
      activeQr.code,
      actor.companyId,
    );
    expect(result).toMatchObject({
      id: vehicle.id,
      plate: 'ABC1D23',
      model: 'Corolla',
      freePass: false,
      isBlocked: false,
      vehicleType: { code: 'FROTA' },
      department: {
        id: '40000000-0000-0000-0000-000000000002',
        name: 'Recepção',
      },
      drivers: [
        {
          user: { id: '30000000-0000-0000-0000-000000000003', name: 'Maria' },
          isPrimary: true,
          canDrive: true,
        },
      ],
    });
  });

  it('lança NotFoundException para code desconhecido (ou de outro tenant)', async () => {
    vehicleQrRepoMock.findByCodeAndCompanyId.mockResolvedValue(null);

    await expect(
      useCase.execute(actor, new ResolveVehicleQrInputDto('code-desconhecido')),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('lança GoneException quando o QR está revogado (expirado)', async () => {
    vehicleQrRepoMock.findByCodeAndCompanyId.mockResolvedValue(revokedQr);

    await expect(
      useCase.execute(actor, new ResolveVehicleQrInputDto(revokedQr.code)),
    ).rejects.toBeInstanceOf(GoneException);
  });
});
