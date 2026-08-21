// NestJS
import { ConflictException, NotFoundException } from '@nestjs/common';
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

// Repositories
import { VEHICLE_QR_REPOSITORY } from '../../domain/repositories/vehicle-qr.repository';
import { VEHICLE_REPOSITORY } from '../../domain/repositories/vehicle.repository';

// DTO
import { GetVehicleQrInputDto } from '../../application/dto/get-vehicle-qr-input.dto';

// Use case
import { EmitVehicleQrUseCase } from '../../application/use-cases/emit-vehicle-qr.use-case';

describe('EmitVehicleQrUseCase', () => {
  let useCase: EmitVehicleQrUseCase;

  const vehicleQrRepoMock = {
    findActiveByVehicleIdAndCompanyId: jest.fn(),
    create: jest.fn(),
  } as jest.Mocked<
    Pick<VehicleQrRepository, 'findActiveByVehicleIdAndCompanyId' | 'create'>
  >;

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
    permissions: [PermissionCode.PRINT_QRCODE],
  };

  const vehicle: VehicleWithTypeEntity = {
    id: '40000000-0000-0000-0000-000000000010',
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

  const createdQr: VehicleQrEntity = {
    id: '50000000-0000-0000-0000-000000000010',
    companyId: actor.companyId,
    vehicleId: vehicle.id,
    code: '550e8400-e29b-41d4-a716-446655440000',
    isActive: true,
    issuedBy: actor.id,
    printedAt: null,
    createdAt: new Date('2026-08-21T00:00:00Z'),
    updatedAt: new Date('2026-08-21T00:00:00Z'),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module = await Test.createTestingModule({
      providers: [
        EmitVehicleQrUseCase,
        { provide: VEHICLE_QR_REPOSITORY, useValue: vehicleQrRepoMock },
        { provide: VEHICLE_REPOSITORY, useValue: vehicleRepoMock },
      ],
    }).compile();
    useCase = module.get(EmitVehicleQrUseCase);
  });

  it('emite o QR com code uuid e issued_by = ator', async () => {
    vehicleRepoMock.findByIdAndCompanyId.mockResolvedValue(vehicle);
    vehicleQrRepoMock.findActiveByVehicleIdAndCompanyId.mockResolvedValue(null);
    vehicleQrRepoMock.create.mockResolvedValue(createdQr);

    const result = await useCase.execute(
      actor,
      new GetVehicleQrInputDto(vehicle.id),
    );

    expect(vehicleRepoMock.findByIdAndCompanyId).toHaveBeenCalledWith(
      vehicle.id,
      actor.companyId,
    );
    expect(vehicleQrRepoMock.create).toHaveBeenCalledWith({
      companyId: actor.companyId,
      vehicleId: vehicle.id,
      code: expect.stringMatching(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
      ),
      issuedBy: actor.id,
    });
    expect(result).toMatchObject({
      id: createdQr.id,
      vehicleId: vehicle.id,
      code: createdQr.code,
      isActive: true,
      issuedBy: actor.id,
    });
  });

  it('lança NotFoundException quando o veículo não existe na empresa', async () => {
    vehicleRepoMock.findByIdAndCompanyId.mockResolvedValue(null);

    await expect(
      useCase.execute(actor, new GetVehicleQrInputDto(vehicle.id)),
    ).rejects.toBeInstanceOf(NotFoundException);

    expect(vehicleQrRepoMock.create).not.toHaveBeenCalled();
  });

  it('lança ConflictException quando já existe QR ativo para o veículo', async () => {
    vehicleRepoMock.findByIdAndCompanyId.mockResolvedValue(vehicle);
    vehicleQrRepoMock.findActiveByVehicleIdAndCompanyId.mockResolvedValue(
      createdQr,
    );

    await expect(
      useCase.execute(actor, new GetVehicleQrInputDto(vehicle.id)),
    ).rejects.toBeInstanceOf(ConflictException);

    expect(vehicleQrRepoMock.create).not.toHaveBeenCalled();
  });
});
