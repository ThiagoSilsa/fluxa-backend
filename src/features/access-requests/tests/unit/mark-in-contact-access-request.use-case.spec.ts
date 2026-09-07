// NestJS
import { ConflictException, NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';

// Shared
import { PermissionCode } from '../../../../shared/constants/access-control.constant';

// Constants
import { UserType } from '../../../auth/domain/constants/user-type.constant';
import {
  AccessRequestStatus,
  AccessRequestType,
  ContactChannel,
} from '../../domain/constants/access-request.constant';

// Types
import type { AuthenticatedUserEntity } from '../../../auth/domain/entities/authenticated-user.entity';
import type { AccessRequestEntity } from '../../domain/entities/access-request.entity';
import type { UserEntity } from '../../../users/domain/entities/user.entity';
import type { AccessRequestRepository } from '../../domain/repositories/access-request.repository';
import type { UserRepository } from '../../../users/domain/repositories/user.repository';

// Repositories
import { ACCESS_REQUEST_REPOSITORY } from '../../domain/repositories/access-request.repository';
import { USER_REPOSITORY } from '../../../users/domain/repositories/user.repository';

// DTOs
import { HandleAccessRequestInputDto } from '../../application/dto/handle-access-request-input.dto';

// Use case
import { MarkInContactAccessRequestUseCase } from '../../application/use-cases/mark-in-contact-access-request.use-case';

describe('MarkInContactAccessRequestUseCase', () => {
  let useCase: MarkInContactAccessRequestUseCase;

  const accessRequestRepoMock = {
    findByIdAndCompanyId: jest.fn(),
    updateStatusByIdAndCompanyId: jest.fn(),
  } as jest.Mocked<
    Pick<
      AccessRequestRepository,
      'findByIdAndCompanyId' | 'updateStatusByIdAndCompanyId'
    >
  >;

  const userRepoMock = {
    findById: jest.fn(),
  } as jest.Mocked<Pick<UserRepository, 'findById'>>;

  const admin: AuthenticatedUserEntity = {
    id: '30000000-0000-0000-0000-000000000001',
    companyId: '10000000-0000-0000-0000-000000000001',
    email: 'admin@somar.local',
    name: 'Administrador',
    type: UserType.EMPLOYEE,
    isAdmin: true,
    roleCodes: ['Administração'],
    permissions: [PermissionCode.MANAGE_ACCESS_REQUESTS],
  };

  const doormanUser: UserEntity = {
    id: '30000000-0000-0000-0000-000000000002',
    name: 'Porteiro Silva',
    email: 'porteiro@somar.local',
    passwordHash: 'hash',
    phone: null,
    document: null,
    photoUrl: null,
    lastLoginAt: null,
    createdAt: new Date('2026-08-21T00:00:00Z'),
    updatedAt: new Date('2026-08-21T00:00:00Z'),
  };

  const request: AccessRequestEntity = {
    id: '50000000-0000-0000-0000-000000000001',
    companyId: admin.companyId,
    idempotencyKey: 'req-1',
    type: AccessRequestType.NEW_VEHICLE,
    plate: 'XYZ9A99',
    vehicleId: null,
    userId: doormanUser.id,
    status: AccessRequestStatus.PENDING,
    entryAuthorized: false,
    authorizedBy: null,
    authorizedAt: null,
    requestedBy: doormanUser.id,
    requestedAt: new Date('2026-08-24T11:00:00Z'),
    handledBy: null,
    handledAt: null,
    contactChannel: ContactChannel.WHATSAPP,
    contactPhone: '11999999999',
    departmentId: null,
    payload: { vehicle: { model: 'Onix' } },
    statusHistory: [],
    resolvedUserId: null,
    resolvedVehicleId: null,
    observation: null,
    createdAt: new Date('2026-08-24T11:00:00Z'),
    updatedAt: new Date('2026-08-24T11:00:00Z'),
  };

  const inContact: AccessRequestEntity = {
    ...request,
    status: AccessRequestStatus.IN_CONTACT,
    handledBy: admin.id,
    handledAt: new Date('2026-08-24T12:00:00Z'),
    observation: 'Entrei em contato com o motorista',
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module = await Test.createTestingModule({
      providers: [
        MarkInContactAccessRequestUseCase,
        { provide: ACCESS_REQUEST_REPOSITORY, useValue: accessRequestRepoMock },
        { provide: USER_REPOSITORY, useValue: userRepoMock },
      ],
    }).compile();
    useCase = module.get(MarkInContactAccessRequestUseCase);
  });

  it('marca a solicitação pendente como IN_CONTACT (regra 39)', async () => {
    accessRequestRepoMock.findByIdAndCompanyId.mockResolvedValue(request);
    accessRequestRepoMock.updateStatusByIdAndCompanyId.mockResolvedValue(
      inContact,
    );
    userRepoMock.findById.mockResolvedValue(doormanUser);

    const result = await useCase.execute(
      admin,
      new HandleAccessRequestInputDto(
        request.id,
        'Entrei em contato com o motorista',
      ),
    );

    expect(
      accessRequestRepoMock.updateStatusByIdAndCompanyId,
    ).toHaveBeenCalledWith(request.id, admin.companyId, {
      status: AccessRequestStatus.IN_CONTACT,
      handledBy: admin.id,
      observation: 'Entrei em contato com o motorista',
    });
    expect(result.status).toBe(AccessRequestStatus.IN_CONTACT);
    expect(result.handledBy).toEqual({ id: admin.id, name: admin.name });
  });

  it('lança 404 quando a solicitação não existe na empresa', async () => {
    accessRequestRepoMock.findByIdAndCompanyId.mockResolvedValue(null);

    await expect(
      useCase.execute(admin, new HandleAccessRequestInputDto(request.id)),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('lança 409 quando a solicitação não está pendente', async () => {
    accessRequestRepoMock.findByIdAndCompanyId.mockResolvedValue(inContact);

    await expect(
      useCase.execute(admin, new HandleAccessRequestInputDto(request.id)),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(
      accessRequestRepoMock.updateStatusByIdAndCompanyId,
    ).not.toHaveBeenCalled();
  });
});
