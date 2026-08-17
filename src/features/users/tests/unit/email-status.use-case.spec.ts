// NestJS
import { Test } from '@nestjs/testing';

// Shared
import { PermissionCode } from '../../../../shared/constants/access-control.constant';

// Constants
import { UserType } from '../../../auth/domain/constants/user-type.constant';

// Types
import type { AuthenticatedUserEntity } from '../../../auth/domain/entities/authenticated-user.entity';
import type { UserEntity } from '../../domain/entities/user.entity';
import type { UserRepository } from '../../domain/repositories/user.repository';

// Repository
import { USER_REPOSITORY } from '../../domain/repositories/user.repository';

// DTO
import { EmailStatusInputDto } from '../../application/dto/email-status-input.dto';

// Use case
import { EmailStatusUseCase } from '../../application/use-cases/email-status.use-case';

describe('EmailStatusUseCase', () => {
  let useCase: EmailStatusUseCase;

  const userRepoMock = {
    findByEmail: jest.fn(),
  } as jest.Mocked<Pick<UserRepository, 'findByEmail'>>;

  const actor: AuthenticatedUserEntity = {
    id: '30000000-0000-0000-0000-000000000001',
    companyId: '10000000-0000-0000-0000-000000000001',
    email: 'admin@somar.local',
    name: 'Administrador',
    type: UserType.EMPLOYEE,
    isAdmin: true,
    roleCodes: ['Administração'],
    permissions: [PermissionCode.MANAGE_USERS],
  };

  const person: UserEntity = {
    id: '60000000-0000-0000-0000-000000000001',
    name: 'Maria',
    email: 'maria@somar.local',
    passwordHash: '$2b$10$hash',
    phone: null,
    document: null,
    photoUrl: null,
    lastLoginAt: null,
    createdAt: new Date('2026-08-15T00:00:00Z'),
    updatedAt: new Date('2026-08-15T00:00:00Z'),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module = await Test.createTestingModule({
      providers: [
        EmailStatusUseCase,
        { provide: USER_REPOSITORY, useValue: userRepoMock },
      ],
    }).compile();
    useCase = module.get(EmailStatusUseCase);
  });

  it('devolve { exists: true } quando o e-mail existe (normalizado)', async () => {
    userRepoMock.findByEmail.mockResolvedValue(person);

    const result = await useCase.execute(
      actor,
      new EmailStatusInputDto('  Maria@Somar.Local '),
    );

    expect(userRepoMock.findByEmail).toHaveBeenCalledWith('maria@somar.local');
    expect(result).toEqual({ exists: true });
  });

  it('devolve { exists: false } quando o e-mail não existe', async () => {
    userRepoMock.findByEmail.mockResolvedValue(null);

    const result = await useCase.execute(
      actor,
      new EmailStatusInputDto('nobody@somar.local'),
    );

    expect(result).toEqual({ exists: false });
  });

  it('não devolve nada além do boolean', async () => {
    userRepoMock.findByEmail.mockResolvedValue(person);

    const result = await useCase.execute(
      actor,
      new EmailStatusInputDto('maria@somar.local'),
    );

    expect(Object.keys(result)).toEqual(['exists']);
  });
});
