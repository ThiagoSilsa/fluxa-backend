import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { UnauthorizedException } from '@nestjs/common';
import { JwtTokenSignUseCase } from '../../../../shared/security/jwt-token-sign.use-case';
import { UserType } from '../../domain/constants/user-type.constant';
import { AuthUserEntity } from '../../domain/entities/auth-user.entity';
import { AuthenticatedUserEntity } from '../../domain/entities/authenticated-user.entity';
import {
  AuthRepository,
  AUTH_REPOSITORY,
} from '../../domain/repositories/auth.repository';
import { SwitchCompanyInputDto } from '../dto/switch-company-input.dto';
import { SwitchCompanyUseCase } from './switch-company.use-case';

describe('SwitchCompanyUseCase', () => {
  let useCase: SwitchCompanyUseCase;

  const authRepoMock = {
    findUserInCompany: jest.fn(),
  } as jest.Mocked<Pick<AuthRepository, 'findUserInCompany'>>;

  const jwtSignMock = {
    execute: jest.fn(),
  } as jest.Mocked<Pick<JwtTokenSignUseCase, 'execute'>>;

  const actor: AuthenticatedUserEntity = {
    id: '30000000-0000-0000-0000-000000000001',
    companyId: '10000000-0000-0000-0000-000000000001',
    email: 'admin@somar.local',
    name: 'Administrador',
    type: UserType.EMPLOYEE,
    roleCodes: ['Administração'],
    permissions: [],
  };

  const targetCompanyId = '20000000-0000-0000-0000-000000000002';

  const targetCandidate: AuthUserEntity = {
    id: actor.id,
    name: 'Administrador',
    email: actor.email,
    passwordHash: '$2b$10$hash',
    companyId: targetCompanyId,
    companyName: 'Outra Autarquia',
    companyIsActive: true,
    type: UserType.EMPLOYEE,
    isActive: true,
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    jwtSignMock.execute.mockResolvedValue('token.novo');

    const module = await Test.createTestingModule({
      providers: [
        SwitchCompanyUseCase,
        {
          provide: AUTH_REPOSITORY,
          useValue: authRepoMock,
        },
        {
          provide: JwtTokenSignUseCase,
          useValue: jwtSignMock,
        },
        {
          provide: ConfigService,
          useValue: { get: jest.fn().mockReturnValue('28800s') },
        },
      ],
    }).compile();
    useCase = module.get(SwitchCompanyUseCase);
  });

  it('emite token novo com o novo companyId (sem pedir senha)', async () => {
    authRepoMock.findUserInCompany.mockResolvedValue(targetCandidate);

    const result = await useCase.execute(
      actor,
      new SwitchCompanyInputDto(targetCompanyId),
    );

    expect(result).toMatchObject({
      accessToken: 'token.novo',
      tokenType: 'Bearer',
      expiresIn: 28800,
      user: {
        id: actor.id,
        name: actor.name,
        email: actor.email,
        type: UserType.EMPLOYEE,
      },
    });
    expect(jwtSignMock.execute).toHaveBeenCalledWith({
      sub: actor.id,
      companyId: targetCompanyId,
      email: actor.email,
    });
  });

  it('lança 401 quando não há vínculo com a empresa', async () => {
    authRepoMock.findUserInCompany.mockResolvedValue(null);

    await expect(
      useCase.execute(actor, new SwitchCompanyInputDto(targetCompanyId)),
    ).rejects.toThrow(UnauthorizedException);
    expect(jwtSignMock.execute).not.toHaveBeenCalled();
  });

  it('lança 401 quando o vínculo está inativo', async () => {
    authRepoMock.findUserInCompany.mockResolvedValue({
      ...targetCandidate,
      isActive: false,
    });

    await expect(
      useCase.execute(actor, new SwitchCompanyInputDto(targetCompanyId)),
    ).rejects.toThrow(UnauthorizedException);
  });
});
