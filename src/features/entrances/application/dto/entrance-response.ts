// Shared
import type { ParameterDto } from '../../../../shared/dto/parameter.dto';

/**
 * Portaria no formato de resposta (nunca a entidade crua do banco —
 * AGENTS.md §3).
 */
export interface EntranceResponse {
  /** Id da portaria. */
  id: string;
  /** Nome da portaria. */
  name: string;
  /** Se a portaria está ativa. */
  isActive: boolean;
}

/**
 * Resposta paginada de portarias — formato padrão do AGENTS.md §3 (`limit`,
 * `offset`, `data`, `count`, `parameters?`).
 */
export interface ListEntrancesResponse {
  /** Quantidade de registros retornados. */
  limit: number;
  /** Offset da página. */
  offset: number;
  /** Registros da página. */
  data: EntranceResponse[];
  /** Total de registros (sem paginação). */
  count: number;
  /** Metadados opcionais de filtros. */
  parameters?: ParameterDto[];
}
