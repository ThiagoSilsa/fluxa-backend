// Shared
import type { ParameterDto } from '../../../../shared/dto/parameter.dto';

/**
 * Tipo de veículo no formato de resposta (nunca a entidade crua do banco —
 * AGENTS.md §3).
 */
export interface VehicleTypeResponse {
  /** Id do tipo. */
  id: string;
  /** Código único por empresa (ex.: `FROTA`). */
  code: string;
  /** Nome do tipo. */
  name: string;
  /** Descrição opcional. */
  description: string | null;
  /** Classificação "frota da empresa". */
  isFleet: boolean;
  /** Se o tipo está ativo. */
  isActive: boolean;
}

/**
 * Resposta paginada de tipos de veículo — formato padrão do AGENTS.md §3
 * (`limit`, `offset`, `data`, `count`, `parameters?`).
 */
export interface ListVehicleTypesResponse {
  /** Quantidade de registros retornados. */
  limit: number;
  /** Offset da página. */
  offset: number;
  /** Registros da página. */
  data: VehicleTypeResponse[];
  /** Total de registros (sem paginação). */
  count: number;
  /** Metadados opcionais de filtros. */
  parameters?: ParameterDto[];
}
