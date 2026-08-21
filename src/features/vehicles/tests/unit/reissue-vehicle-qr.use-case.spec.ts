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
import { ReissueVehicleQrUseCase } from '../../application/use-cases/reissue-vehicle-qr.use-case';

describe('ReissueVehicleQrUseCase', () => {
  let useCase: ReissueVehicleQrUseCase;

  const vehicleQrRepoMock = {
    findActiveByVehicleIdAndCompanyId: jest.fn(),
    reissue: jest.fn(),
  } as jest.Mocked<
    Pick<VehicleQrRepository, 'findActiveByVehicleIdAndCompanyId' | 'reissue'>
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

  const activeQr: VehicleQrEntity = {
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

  const reissuedQr: VehicleQrEntity = {
    ...activeQr,
    id: '50000000-0000-0000-0000-000000000011',
    code: '6ba7b810-9dad-11d1-80b4-00c04fd430c8',
    createdAt: new Date('2026-08-21T01:00:00Z'),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module = await Test.createTestingModule({
      providers: [
        ReissueVehicleQrUseCase,
        { provide: VEHICLE_QR_REPOSITORY, useValue: vehicleQrRepoMock },
        { provide: VEHICLE_REPOSITORY, useValue: vehicleRepoMock },
      ],
    }).compile();
    useCase = module.get(ReissueVehicleQrUseCase);
  });

  it('reemite com novo code e issued_by = ator', async () => {
    vehicleRepoMock.findByIdAndCompanyId.mockResolvedValue(vehicle);
    vehicleQrRepoMock.findActiveByVehicleIdAndCompanyId.mockResolvedValue(
      activeQr,
    );
    vehicleQrRepoMock.reissue.mockResolvedValue(reissuedQr);

    const result = await useCase.execute(
      actor,
      new GetVehicleQrInputDto(vehicle.id),
    );

    expect(vehicleQrRepoMock.reissue).toHaveBeenCalledWith(
      vehicle.id,
      actor.companyId,
      {
        code: expect.stringMatching(
          /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
        ),
        issuedBy: actor.id,
      },
    );
    expect(result.code).toBe(reissuedQr.code);
  });

  it('lança NotFoundException quando o veículo não existe na empresa', async () => {
    vehicleRepoMock.findByIdAndCompanyId.mockResolvedValue(null);

    await expect(
      useCase.execute(actor, new GetVehicleQrInputDto(vehicle.id)),
    ).rejects.toBeInstanceOf(NotFoundException);

    expect(vehicleQrRepoMock.reissue).not.toHaveBeenCalled();
  });

  it('lança ConflictException quando não há QR ativo para reemitir', async () => {
    vehicleRepoMock.findByIdAndCompanyId.mockResolvedValue(vehicle);
    vehicleQrRepoMock.findActiveByVehicleIdAndCompanyId.mockResolvedValue(null);

    await expect(
      useCase.execute(actor, new GetVehicleQrInputDto(vehicle.id)),
    ).rejects.toBeInstanceOf(ConflictException);

    expect(vehicleQrRepoMock.reissue).not.toHaveBeenCalled();
  });
});
