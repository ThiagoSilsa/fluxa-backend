/**
 * Permissão (catálogo global, sem empresa) — entidade de domínio.
 *
 * Espelha a tabela `permission` (migration `0001`): catálogo global do
 * sistema, populado por seed e somente leitura pela aplicação (ADR 0004).
 */
export interface PermissionEntity {
  /** Id da permissão. */
  id: string;
  /** Código único (ex.: `MANAGE_ROLES`). */
  code: string;
  /** Descrição opcional. */
  description: string | null;
}
