// Utils
import { isValidBrazilianPlate, normalizePlate } from './plate.util';

describe('normalizePlate', () => {
  it('remove espaços nas bordas', () => {
    expect(normalizePlate('  ABC1234  ')).toBe('ABC1234');
  });

  it('converte para maiúsculas', () => {
    expect(normalizePlate('abc1234')).toBe('ABC1234');
  });

  it('remove hífen', () => {
    expect(normalizePlate('ABC-1234')).toBe('ABC1234');
  });

  it('remove espaços internos', () => {
    expect(normalizePlate('ABC 1D23')).toBe('ABC1D23');
  });

  it('mantém placa já normalizada', () => {
    expect(normalizePlate('ABC1D23')).toBe('ABC1D23');
  });

  it('combina trim, uppercase, hífen e espaço', () => {
    expect(normalizePlate('  abc-1d 23  ')).toBe('ABC1D23');
  });

  it('lida com string vazia', () => {
    expect(normalizePlate('')).toBe('');
  });
});

describe('isValidBrazilianPlate', () => {
  it('aceita formato antigo (ABC1234)', () => {
    expect(isValidBrazilianPlate('ABC1234')).toBe(true);
  });

  it('aceita formato Mercosul (ABC1D23)', () => {
    expect(isValidBrazilianPlate('ABC1D23')).toBe(true);
  });

  it('normaliza antes de validar (caixa mista, hífen, espaço)', () => {
    expect(isValidBrazilianPlate('abc-1234')).toBe(true);
    expect(isValidBrazilianPlate(' abc 1d23 ')).toBe(true);
  });

  it('rejeita placa com menos de 7 caracteres', () => {
    expect(isValidBrazilianPlate('ABC123')).toBe(false);
  });

  it('rejeita placa com mais de 7 caracteres', () => {
    expect(isValidBrazilianPlate('ABCD1234')).toBe(false);
  });

  it('rejeita placas sem o padrão de letras/dígitos', () => {
    expect(isValidBrazilianPlate('1234567')).toBe(false);
    expect(isValidBrazilianPlate('AB1C234')).toBe(false);
    expect(isValidBrazilianPlate('ABC!234')).toBe(false);
  });

  it('rejeita string vazia', () => {
    expect(isValidBrazilianPlate('')).toBe(false);
  });
});
