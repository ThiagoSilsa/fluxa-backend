// NestJS
import { NotFoundException } from '@nestjs/common';
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
import { GetAccessRequestUseCase } from '../../application/use-cases/get-access-request.use-case';

describe('GetAccessRequestUseCase', () => {
  let useCase: GetAccessRequestUseCase;

  const accessRequestRepoMock = {
    findByIdAndCompanyId: jest.fn(),
  } as jest.Mocked<Pick<AccessRequestRepository, 'findByIdAndCompanyId'>>;

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
    type: AccessRequestType.BOTH,
    plate: 'XYZ9A99',
    vehicleId: null,
    userId: null,
    status: AccessRequestStatus.REGISTERED,
    entryAuthorized: true,
    authorizedBy: admin.id,
    authorizedAt: new Date('2026-08-24T12:00:00Z'),
    requestedBy: doormanUser.id,
    requestedAt: new Date('2026-08-24T11:00:00Z'),
    handledBy: admin.id,
    handledAt: new Date('2026-08-24T12:00:00Z'),
    contactChannel: ContactChannel.WHATSAPP,
    contactPhone: '11999999999',
    departmentId: null,
    payload: {},
    statusHistory: [
      {
        status: AccessRequestStatus.PENDING,
        at: '2026-08-24T11:00:00Z',
        by: doormanUser.id,
      },
    ],
    resolvedUserId: '30000000-0000-0000-0000-000000000005',
    resolvedVehicleId: '40000000-0000-0000-0000-000000000010',
    observation: null,
    createdAt: new Date('2026-08-24T11:00:00Z'),
    updatedAt: new Date('2026-08-24T12:00:00Z'),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module = await Test.createTestingModule({
      providers: [
        GetAccessRequestUseCase,
        { provide: ACCESS_REQUEST_REPOSITORY, useValue: accessRequestRepoMock },
        { provide: USER_REPOSITORY, useValue: userRepoMock },
      ],
    }).compile();
    useCase = module.get(GetAccessRequestUseCase);
  });

  it('detalha solicitação resolvendo requested_by/handled_by/authorized_by', async () => {
    accessRequestRepoMock.findByIdAndCompanyId.mockResolvedValue(request);
    // Só o porteiro é resolvido; os atores admin não existem no repositório.
    userRepoMock.findById.mockImplementation((id) =>
      id === doormanUser.id
        ? Promise.resolve(doormanUser)
        : Promise.resolve(null),
    );

    const result = await useCase.execute(
      admin,
      new HandleAccessRequestInputDto(request.id),
    );

    expect(accessRequestRepoMock.findByIdAndCompanyId).toHaveBeenCalledWith(
      request.id,
      admin.companyId,
    );
    // requestedBy resolvido; handledBy/authorizedBy (admin) não resolvidos → null.
    expect(result.requestedBy).toEqual({
      id: doormanUser.id,
      name: doormanUser.name,
    });
    expect(result.handledBy).toBeNull();
    expect(result.authorizedBy).toBeNull();
    expect(result.resolvedUserId).toBe(request.resolvedUserId);
  });

  it('lança 404 quando a solicitação não existe na empresa (cross-tenant oculto)', async () => {
    accessRequestRepoMock.findByIdAndCompanyId.mockResolvedValue(null);

    await expect(
      useCase.execute(admin, new HandleAccessRequestInputDto(request.id)),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(userRepoMock.findById).not.toHaveBeenCalled();
  });
});
