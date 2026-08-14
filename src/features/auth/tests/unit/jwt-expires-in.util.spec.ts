// Utils
import { parseExpiresInToSeconds } from '../../application/utils/jwt-expires-in.util';

/**
 * Testes unitários do parser de `JWT_EXPIRES_IN` (formato do `ms`).
 *
 * Suporta `s`/`m`/`h`/`d` (case-insensitive, com espaços) e lança `Error` para
 * formatos fora do esperado — a resposta de login (`expiresIn`) depende disso.
 */
describe('parseExpiresInToSeconds', () => {
  it('converte segundos ("28800s")', () => {
    expect(parseExpiresInToSeconds('28800s')).toBe(28800);
  });

  it('converte minutos ("60m")', () => {
    expect(parseExpiresInToSeconds('60m')).toBe(3600);
  });

  it('converte horas ("1h")', () => {
    expect(parseExpiresInToSeconds('1h')).toBe(3600);
  });

  it('converte dias ("1d")', () => {
    expect(parseExpiresInToSeconds('1d')).toBe(86400);
  });

  it('é case-insensitive e ignora espaços', () => {
    expect(parseExpiresInToSeconds(' 1H ')).toBe(3600);
  });

  it('lança erro quando falta a unidade de tempo', () => {
    expect(() => parseExpiresInToSeconds('3600')).toThrow(Error);
  });

  it('lança erro para formato inválido ou vazio', () => {
    expect(() => parseExpiresInToSeconds('abc')).toThrow(Error);
    expect(() => parseExpiresInToSeconds('')).toThrow(Error);
  });
});
