/**
 * Verifica se o valor é um objeto não-nulo.
 *
 * Usado para estreitar `response.body` (`unknown`) em testes de integração
 * sem recorrer a `any` (AGENTS.md — `any` é proibido).
 *
 * @param value Valor a verificar.
 * @returns `true` quando é um objeto não-nulo.
 */
export function isObjectRecord(
  value: unknown,
): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
