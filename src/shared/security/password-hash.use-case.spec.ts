import { Test } from '@nestjs/testing';
import { PasswordHashUseCase } from './password-hash.use-case';

describe('PasswordHashUseCase', () => {
  let useCase: PasswordHashUseCase;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [PasswordHashUseCase],
    }).compile();
    useCase = module.get(PasswordHashUseCase);
  });

  it('gera um hash bcrypt (nunca texto puro)', () => {
    const hash = useCase.execute('senha-secreta');
    expect(hash).toMatch(/^\$2[aby]\$/);
    expect(hash).not.toContain('senha-secreta');
  });

  it('gera hashes diferentes para a mesma senha (salt)', () => {
    expect(useCase.execute('senha-secreta')).not.toBe(
      useCase.execute('senha-secreta'),
    );
  });
});
