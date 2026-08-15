// Shared
import type { ParameterDto } from '../../../../shared/dto/parameter.dto';

/**
 * Departamento no formato de resposta (nunca a entidade crua do banco —
 * AGENTS.md §3).
 */
export interface DepartmentResponse {
  /** Id do departamento. */
  id: string;
  /** Nome do departamento. */
  name: string;
  /** Descrição opcional. */
  description: string | null;
  /** Quantidade de vagas. */
  parkingSpace: number;
  /** Se o departamento está ativo. */
  isActive: boolean;
}

/**
 * Resposta paginada de departamentos — formato padrão do AGENTS.md §3
 * (`limit`, `offset`, `data`, `count`, `parameters?`).
 */
export interface ListDepartmentsResponse {
  /** Quantidade de registros retornados. */
  limit: number;
  /** Offset da página. */
  offset: number;
  /** Registros da página. */
  data: DepartmentResponse[];
  /** Total de registros (sem paginação). */
  count: number;
  /** Metadados opcionais de filtros. */
  parameters?: ParameterDto[];
}
