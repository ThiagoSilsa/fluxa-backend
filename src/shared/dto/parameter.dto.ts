/**
 * Metadados de um filtro de listagem (AGENTS.md §3 — endpoints paginados).
 *
 * `parameters` é opcional na resposta de listagem e inclui `allowed_values`
 * com objetos completos para filtros de entidade (ex.: departamentos como
 * `[{ id, name }]`). `isAdmin` é opcional e usado quando o parâmetro é um
 * catálogo de cargos (ex.: `role_id` na listagem de usuários).
 */
export interface ParameterDto {
  /** Chave do parâmetro (ex.: `department_id`). */
  key: string;
  /** Rótulo amigável do parâmetro (ex.: `Departamento`). */
  label: string;
  /** Valores permitidos para o filtro (objetos completos). */
  allowed_values?: { id: string; name: string; isAdmin?: boolean }[];
}
