import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import { UnauthorizedException } from '@nestjs/common';
import { JwtTokenVerifyUseCase } from './jwt-token-verify.use-case';

describe('JwtTokenVerifyUseCase', () => {
  let useCase: JwtTokenVerifyUseCase;
  const jwtServiceMock = {
    verifyAsync: jest.fn(),
  } as jest.Mocked<Pick<JwtService, 'verifyAsync'>>;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        JwtTokenVerifyUseCase,
        {
          provide: JwtService,
          useValue: jwtServiceMock,
        },
      ],
    }).compile();
    useCase = module.get(JwtTokenVerifyUseCase);
    jest.clearAllMocks();
  });

  it('retorna o payload para token válido', async () => {
    const payload = {
      sub: '30000000-0000-0000-0000-000000000001',
      companyId: '10000000-0000-0000-0000-000000000001',
      email: 'admin@somar.local',
      exp: 9999999999,
    };
    jwtServiceMock.verifyAsync.mockResolvedValue(payload);

    await expect(useCase.execute('token.valido')).resolves.toEqual(payload);
  });

  it('lança 401 para token inválido/expirado', async () => {
    jwtServiceMock.verifyAsync.mockRejectedValue(new Error('jwt expired'));

    await expect(useCase.execute('token.expirado')).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('lança 401 quando faltam campos obrigatórios', async () => {
    jwtServiceMock.verifyAsync.mockResolvedValue({ sub: 'apenas-sub' });

    await expect(useCase.execute('token.incompleto')).rejects.toThrow(
      UnauthorizedException,
    );
  });
});
