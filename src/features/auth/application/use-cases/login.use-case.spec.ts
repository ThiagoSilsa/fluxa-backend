import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { UnauthorizedException } from '@nestjs/common';
import { JwtTokenSignUseCase } from '../../../../shared/security/jwt-token-sign.use-case';
import { PasswordVerifyUseCase } from '../../../../shared/security/password-verify.use-case';
import { UserType } from '../../domain/constants/user-type.constant';
import { AuthUserEntity } from '../../domain/entities/auth-user.entity';
import {
  AuthRepository,
  AUTH_REPOSITORY,
} from '../../domain/repositories/auth.repository';
import { LoginInputDto } from '../dto/login-input.dto';
import { LoginUseCase } from './login.use-case';

describe('LoginUseCase', () => {
  let useCase: LoginUseCase;

  const authRepoMock = {
    findUsersByEmail: jest.fn(),
  } as jest.Mocked<Pick<AuthRepository, 'findUsersByEmail'>>;

  const passwordVerifyMock = {
    execute: jest.fn(),
  } as jest.Mocked<Pick<PasswordVerifyUseCase, 'execute'>>;

  const jwtSignMock = {
    execute: jest.fn(),
  } as jest.Mocked<Pick<JwtTokenSignUseCase, 'execute'>>;

  const somarCandidate: AuthUserEntity = {
    id: '30000000-0000-0000-0000-000000000001',
    name: 'Administrador',
    email: 'admin@somar.local',
    passwordHash: '$2b$10$hash',
    companyId: '10000000-0000-0000-0000-000000000001',
    companyName: 'SOMAR',
    companyIsActive: true,
    type: UserType.EMPLOYEE,
    isActive: true,
  };

  const secondCompanyCandidate: AuthUserEntity = {
    ...somarCandidate,
    companyId: '20000000-0000-0000-0000-000000000002',
    companyName: 'Outra Autarquia',
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    passwordVerifyMock.execute.mockReturnValue(true);
    jwtSignMock.execute.mockResolvedValue('token.jwt');

    const module = await Test.createTestingModule({
      providers: [
        LoginUseCase,
        {
          provide: AUTH_REPOSITORY,
          useValue: authRepoMock,
        },
        {
          provide: PasswordVerifyUseCase,
          useValue: passwordVerifyMock,
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
    useCase = module.get(LoginUseCase);
  });

  it('entra direto quando há 1 empresa vinculada', async () => {
    authRepoMock.findUsersByEmail.mockResolvedValue([somarCandidate]);

    const result = await useCase.execute(
      new LoginInputDto('admin@somar.local', 'senha'),
    );

    expect(result).toMatchObject({
      accessToken: 'token.jwt',
      tokenType: 'Bearer',
      expiresIn: 28800,
      user: { id: somarCandidate.id },
    });
    expect(jwtSignMock.execute).toHaveBeenCalledWith({
      sub: somarCandidate.id,
      companyId: somarCandidate.companyId,
      email: somarCandidate.email,
    });
  });

  it('devolve requiresCompanyChoice quando há N empresas e nenhuma escolha', async () => {
    authRepoMock.findUsersByEmail.mockResolvedValue([
      somarCandidate,
      secondCompanyCandidate,
    ]);

    const result = await useCase.execute(
      new LoginInputDto('admin@somar.local', 'senha'),
    );

    expect(result).toEqual({
      requiresCompanyChoice: true,
      companies: [
        { id: somarCandidate.companyId, name: 'SOMAR' },
        { id: secondCompanyCandidate.companyId, name: 'Outra Autarquia' },
      ],
    });
    expect(jwtSignMock.execute).not.toHaveBeenCalled();
  });

  it('entra na empresa escolhida quando companyId é informado', async () => {
    authRepoMock.findUsersByEmail.mockResolvedValue([
      somarCandidate,
      secondCompanyCandidate,
    ]);

    const result = await useCase.execute(
      new LoginInputDto(
        'admin@somar.local',
        'senha',
        secondCompanyCandidate.companyId,
      ),
    );

    expect(result).toMatchObject({
      accessToken: 'token.jwt',
      user: { id: somarCandidate.id },
    });
    expect(jwtSignMock.execute).toHaveBeenCalledWith(
      expect.objectContaining({ companyId: secondCompanyCandidate.companyId }),
    );
  });

  it('lança 401 quando companyId não corresponde a nenhum vínculo', async () => {
    authRepoMock.findUsersByEmail.mockResolvedValue([somarCandidate]);

    await expect(
      useCase.execute(
        new LoginInputDto(
          'admin@somar.local',
          'senha',
          '00000000-0000-0000-0000-000000000000',
        ),
      ),
    ).rejects.toThrow(UnauthorizedException);
    expect(jwtSignMock.execute).not.toHaveBeenCalled();
  });

  it('lança 401 para senha incorreta', async () => {
    authRepoMock.findUsersByEmail.mockResolvedValue([somarCandidate]);
    passwordVerifyMock.execute.mockReturnValue(false);

    await expect(
      useCase.execute(new LoginInputDto('admin@somar.local', 'errada')),
    ).rejects.toThrow(UnauthorizedException);
  });

  it('lança 401 quando não há candidato ativo', async () => {
    authRepoMock.findUsersByEmail.mockResolvedValue([]);

    await expect(
      useCase.execute(new LoginInputDto('nobody@somar.local', 'senha')),
    ).rejects.toThrow(UnauthorizedException);
  });

  it('ignora vínculos inativos/empresa inativa antes de decidir', async () => {
    authRepoMock.findUsersByEmail.mockResolvedValue([
      { ...somarCandidate, isActive: false },
    ]);

    await expect(
      useCase.execute(new LoginInputDto('admin@somar.local', 'senha')),
    ).rejects.toThrow(UnauthorizedException);
  });
});
