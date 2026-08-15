// NestJS
import { Test } from '@nestjs/testing';

// Shared
import { PermissionCode } from '../../../../shared/constants/access-control.constant';

// Constants
import { UserType } from '../../domain/constants/user-type.constant';

// Types
import type { AuthenticatedUserEntity } from '../../domain/entities/authenticated-user.entity';

// Use-cases
import { ResolveAuthenticatedUserUseCase } from '../../application/use-cases/resolve-authenticated-user.use-case';
import { ValidateJwtPayloadUseCase } from '../../application/use-cases/validate-jwt-payload.use-case';

describe('ValidateJwtPayloadUseCase', () => {
  let useCase: ValidateJwtPayloadUseCase;

  const resolveMock = {
    execute: jest.fn(),
  } as jest.Mocked<Pick<ResolveAuthenticatedUserUseCase, 'execute'>>;

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

  beforeEach(async () => {
    jest.clearAllMocks();
    const module = await Test.createTestingModule({
      providers: [
        ValidateJwtPayloadUseCase,
        {
          provide: ResolveAuthenticatedUserUseCase,
          useValue: resolveMock,
        },
      ],
    }).compile();
    useCase = module.get(ValidateJwtPayloadUseCase);
  });

  it('delega a resolução usando sub e companyId do payload', async () => {
    resolveMock.execute.mockResolvedValue(actor);

    const result = await useCase.execute({
      sub: actor.id,
      companyId: actor.companyId,
      email: actor.email,
    });

    expect(result).toEqual(actor);
    expect(resolveMock.execute).toHaveBeenCalledWith(actor.id, actor.companyId);
  });

  it('repassa null quando a resolução falha', async () => {
    resolveMock.execute.mockResolvedValue(null);

    await expect(
      useCase.execute({ sub: 'x', companyId: 'y', email: 'a@b.co' }),
    ).resolves.toBeNull();
  });
});
