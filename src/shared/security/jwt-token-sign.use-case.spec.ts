import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import { JwtPayload } from './jwt.payload';
import { JwtTokenSignUseCase } from './jwt-token-sign.use-case';

describe('JwtTokenSignUseCase', () => {
  let useCase: JwtTokenSignUseCase;
  const jwtServiceMock = {
    signAsync: jest.fn(),
  } as jest.Mocked<Pick<JwtService, 'signAsync'>>;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        JwtTokenSignUseCase,
        {
          provide: JwtService,
          useValue: jwtServiceMock,
        },
      ],
    }).compile();
    useCase = module.get(JwtTokenSignUseCase);
  });

  it('assina o payload da sessão', async () => {
    jwtServiceMock.signAsync.mockResolvedValue('token.jwt');
    const payload: JwtPayload = {
      sub: '30000000-0000-0000-0000-000000000001',
      companyId: '10000000-0000-0000-0000-000000000001',
      email: 'admin@somar.local',
    };

    await expect(useCase.execute(payload)).resolves.toBe('token.jwt');
    expect(jwtServiceMock.signAsync).toHaveBeenCalledWith(payload);
  });
});
