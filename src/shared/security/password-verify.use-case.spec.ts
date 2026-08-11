import { Test } from '@nestjs/testing';
import { PasswordHashUseCase } from './password-hash.use-case';
import { PasswordVerifyUseCase } from './password-verify.use-case';

describe('PasswordVerifyUseCase', () => {
  let hashUseCase: PasswordHashUseCase;
  let useCase: PasswordVerifyUseCase;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [PasswordHashUseCase, PasswordVerifyUseCase],
    }).compile();
    hashUseCase = module.get(PasswordHashUseCase);
    useCase = module.get(PasswordVerifyUseCase);
  });

  it('retorna true para a senha correta', () => {
    const hash = hashUseCase.execute('senha-correta');
    expect(useCase.execute('senha-correta', hash)).toBe(true);
  });

  it('retorna false para senha incorreta', () => {
    const hash = hashUseCase.execute('senha-correta');
    expect(useCase.execute('senha-errada', hash)).toBe(false);
  });
});
