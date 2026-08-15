/**
 * Normaliza um e-mail para a forma canônica de armazenamento e busca:
 * `trim()` + `toLowerCase()`.
 *
 * O `UNIQUE (email)` do Postgres é case-sensitive; sem normalização,
 * `Admin@x` e `admin@x` seriam duas pessoas (regra §1.3 das regras de
 * usuários). Aplicar em login, `email-status`, criação e edição.
 *
 * Função pura — sem DataSource, sem dependências (AGENTS.md §4).
 *
 * @param email E-mail em texto puro (pode conter espaços nas bordas e caixa
 * mista).
 * @returns E-mail normalizado (minúsculo, sem espaços nas bordas).
 */
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}
