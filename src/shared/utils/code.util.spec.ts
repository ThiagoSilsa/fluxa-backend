// Utils
import { normalizeCode } from './code.util';

describe('normalizeCode', () => {
  it('remove espaços nas bordas', () => {
    expect(normalizeCode('  FROTA  ')).toBe('FROTA');
  });

  it('converte para maiúsculas', () => {
    expect(normalizeCode('frota')).toBe('FROTA');
  });

  it('mantém código já normalizado', () => {
    expect(normalizeCode('PARTICULAR')).toBe('PARTICULAR');
  });

  it('combina trim e uppercase', () => {
    expect(normalizeCode('  particular  ')).toBe('PARTICULAR');
  });

  it('lida com string vazia', () => {
    expect(normalizeCode('')).toBe('');
  });
});
