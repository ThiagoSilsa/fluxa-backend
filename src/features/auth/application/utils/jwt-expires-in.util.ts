/**
 * Converte o valor de `JWT_EXPIRES_IN` (formato do `ms`: `28800s`, `8h`, `1d`)
 * em segundos, para a resposta de login (`expiresIn`).
 *
 * @param expiresIn Valor da env (ex.: `28800s`).
 * @returns Segundos.
 * @throws {Error} Quando o formato não é suportado.
 */
export function parseExpiresInToSeconds(expiresIn: string): number {
  const match = /^(\d+)(s|m|h|d)$/i.exec(expiresIn.trim());
  if (!match) {
    throw new Error(
      `JWT_EXPIRES_IN inválido: "${expiresIn}" (use ex.: 28800s, 8h, 1d).`,
    );
  }
  const value = Number(match[1]);
  const multipliers: Record<string, number> = {
    s: 1,
    m: 60,
    h: 3600,
    d: 86400,
  };
  return value * multipliers[match[2].toLowerCase()];
}
