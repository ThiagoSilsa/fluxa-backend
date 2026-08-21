/**
 * Normaliza um código de catálogo para a forma canônica de armazenamento e
 * busca: `trim()` + `toUpperCase()`.
 *
 * Usada no `vehicle_type.code` (unique `(company_id, code)` do Postgres é
 * case-sensitive — sem normalização, `frota` e `FROTA` seriam tipos distintos;
 * regra §2.6 das regras de cadastros base). Aplicar na criação e edição.
 *
 * Função pura — sem DataSource, sem dependências (AGENTS.md §4).
 *
 * @param value Código em texto puro (pode conter espaços nas bordas e caixa
 * mista).
 * @returns Código normalizado (maiúsculo, sem espaços nas bordas).
 */
export function normalizeCode(value: string): string {
  return value.trim().toUpperCase();
}
