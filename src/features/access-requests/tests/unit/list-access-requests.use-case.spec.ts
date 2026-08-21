// NestJS
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
import { ListAccessRequestsInputDto } from '../../application/dto/list-access-requests-input.dto';

// Use case
import { ListAccessRequestsUseCase } from '../../application/use-cases/list-access-requests.use-case';

describe('ListAccessRequestsUseCase', () => {
  let useCase: ListAccessRequestsUseCase;

  const accessRequestRepoMock = {
    list: jest.fn(),
  } as jest.Mocked<Pick<AccessRequestRepository, 'list'>>;

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

  const pending: AccessRequestEntity = {
    id: '50000000-0000-0000-0000-000000000001',
    companyId: admin.companyId,
    idempotencyKey: 'req-1',
    type: AccessRequestType.NEW_USER,
    plate: 'ABC1D23',
    vehicleId: '40000000-0000-0000-0000-000000000010',
    userId: null,
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
    payload: {},
    statusHistory: [
      {
        status: AccessRequestStatus.PENDING,
        at: '2026-08-24T11:00:00Z',
        by: doormanUser.id,
      },
    ],
    resolvedUserId: null,
    resolvedVehicleId: null,
    observation: null,
    createdAt: new Date('2026-08-24T11:00:00Z'),
    updatedAt: new Date('2026-08-24T11:00:00Z'),
  };

  const registered: AccessRequestEntity = {
    ...pending,
    id: '50000000-0000-0000-0000-000000000002',
    status: AccessRequestStatus.REGISTERED,
    handledBy: admin.id,
    handledAt: new Date('2026-08-24T12:00:00Z'),
    authorizedBy: admin.id,
    authorizedAt: new Date('2026-08-24T12:00:00Z'),
    entryAuthorized: true,
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module = await Test.createTestingModule({
      providers: [
        ListAccessRequestsUseCase,
        { provide: ACCESS_REQUEST_REPOSITORY, useValue: accessRequestRepoMock },
        { provide: USER_REPOSITORY, useValue: userRepoMock },
      ],
    }).compile();
    useCase = module.get(ListAccessRequestsUseCase);
  });

  it('lista solicitações no formato padrão resolvendo atores em lote', async () => {
    accessRequestRepoMock.list.mockResolvedValue({
      data: [pending, registered],
      count: 2,
    });
    userRepoMock.findById.mockResolvedValue(doormanUser);

    const result = await useCase.execute(
      admin,
      new ListAccessRequestsInputDto(AccessRequestStatus.PENDING, 'ABC', 10, 0),
    );

    expect(accessRequestRepoMock.list).toHaveBeenCalledWith(admin.companyId, {
      status: AccessRequestStatus.PENDING,
      plate: 'ABC',
      limit: 10,
      offset: 0,
    });
    // ids distintos: requested_by (2) + handled_by (1) + authorized_by (1).
    expect(userRepoMock.findById).toHaveBeenCalledTimes(2);
    expect(result.count).toBe(2);
    expect(result.data[0].requestedBy).toEqual({
      id: doormanUser.id,
      name: doormanUser.name,
    });
    expect(result.data[0].handledBy).toBeNull();
    // Ator admin não resolvido no mock → null.
    expect(result.data[1].handledBy).toBeNull();
    expect(result.data[1].entryAuthorized).toBe(true);
  });

  it('retorna página vazia quando não há solicitações', async () => {
    accessRequestRepoMock.list.mockResolvedValue({ data: [], count: 0 });

    const result = await useCase.execute(
      admin,
      new ListAccessRequestsInputDto(undefined, undefined, 20, 0),
    );

    expect(result.data).toEqual([]);
    expect(result.count).toBe(0);
  });
});
