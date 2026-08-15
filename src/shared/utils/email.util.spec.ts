// Utils
import { normalizeEmail } from './email.util';

describe('normalizeEmail', () => {
  it('remove espaços nas bordas', () => {
    expect(normalizeEmail('  admin@somar.local  ')).toBe('admin@somar.local');
  });

  it('converte para minúsculas', () => {
    expect(normalizeEmail('Admin@Somar.Local')).toBe('admin@somar.local');
  });

  it('mantém e-mail já normalizado', () => {
    expect(normalizeEmail('admin@somar.local')).toBe('admin@somar.local');
  });

  it('combina trim e lowercase', () => {
    expect(normalizeEmail('  ADMIN@SOMAR.LOCAL  ')).toBe('admin@somar.local');
  });

  it('lida com string vazia', () => {
    expect(normalizeEmail('')).toBe('');
  });
});
