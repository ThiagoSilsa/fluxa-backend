/**
 * Normaliza uma placa de veículo para a forma canônica de armazenamento e
 * busca: `trim()` + `toUpperCase()` + remoção de hífens e espaços.
 *
 * O `UNIQUE (company_id, plate)` do Postgres é case-sensitive; sem
 * normalização, `abc1234` e `ABC1234` seriam veículos distintos (regra §3.10
 * das regras de cadastros base). Aplicar em criação, edição e busca por placa.
 *
 * Função pura — sem DataSource, sem dependências (AGENTS.md §4).
 *
 * @param plate Placa em texto puro (pode conter caixa mista, hífen e espaços).
 * @returns Placa normalizada (maiúscula, sem hífens/espaços).
 */
export function normalizePlate(plate: string): string {
  return plate.trim().toUpperCase().replace(/[\s-]/g, '');
}

/**
 * Valida se uma placa tem formato brasileiro válido — antigo (`ABC1234`) ou
 * Mercosul (`ABC1D23`), exatamente 7 caracteres alfanuméricos após a
 * normalização.
 *
 * Aplica `normalizePlate` internamente antes de validar, então aceita caixa
 * mista, hífen e espaços. Usada apenas no cadastro (administração); placas de
 * veículos não cadastrados (fluxo da portaria, semana 3+) não passam por ela
 * (ADR 0006 §3).
 *
 * Função pura — sem DataSource, sem dependências (AGENTS.md §4).
 *
 * @param plate Placa em texto puro.
 * @returns `true` se o formato é válido (antigo ou Mercosul).
 */
export function isValidBrazilianPlate(plate: string): boolean {
  const normalized = normalizePlate(plate);
  return /^[A-Z]{3}([0-9]{4}|[0-9][A-Z][0-9]{2})$/.test(normalized);
}
