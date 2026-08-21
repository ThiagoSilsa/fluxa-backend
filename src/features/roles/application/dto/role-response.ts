// Shared
import type { ParameterDto } from '../../../../shared/dto/parameter.dto';

/**
 * Cargo no formato de resposta (nunca a entidade crua do banco).
 */
export interface RoleResponse {
  /** Id do cargo. */
  id: string;
  /** Nome do cargo. */
  name: string;
  /** Descrição opcional. */
  description: string | null;
  /** Cargo de administração (acesso total). */
  isAdmin: boolean;
  /** Se o cargo está ativo. */
  isActive: boolean;
}

/**
 * Resposta paginada de cargos — formato padrão do AGENTS.md §3
 * (`limit`, `offset`, `data`, `count`, `parameters?`).
 */
export interface ListRolesResponse {
  /** Quantidade de registros retornados. */
  limit: number;
  /** Offset da página. */
  offset: number;
  /** Registros da página. */
  data: RoleResponse[];
  /** Total de registros (sem paginação). */
  count: number;
  /** Metadados opcionais de filtros. */
  parameters?: ParameterDto[];
}

/**
 * Permissão no formato de resposta (catálogo global).
 */
export interface PermissionResponse {
  /** Id da permissão. */
  id: string;
  /** Código único (ex.: `MANAGE_ROLES`). */
  code: string;
  /** Descrição opcional. */
  description: string | null;
}
