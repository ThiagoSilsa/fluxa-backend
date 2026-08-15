// Shared
import type { ParameterDto } from '../../../../shared/dto/parameter.dto';

/**
 * Resumo do tipo de veículo agregado ao veículo (detalhe/listagem).
 */
export interface VehicleTypeSummary {
  /** Id do tipo. */
  id: string;
  /** Código do tipo (ex.: `FROTA`). */
  code: string;
  /** Nome do tipo. */
  name: string;
  /** Classificação de frota. */
  isFleet: boolean;
}

/**
 * Veículo no formato de resposta (nunca a entidade crua do banco — AGENTS.md
 * §3). `isBlocked` é somente leitura (derivado do bloqueio — ADR 0006 §4).
 */
export interface VehicleResponse {
  /** Id do veículo. */
  id: string;
  /** Placa normalizada. */
  plate: string;
  /** Modelo (opcional). */
  model: string | null;
  /** Cor (opcional). */
  color: string | null;
  /** Observação (opcional). */
  observation: string | null;
  /** Derivado do bloqueio ativo — somente leitura. */
  isBlocked: boolean;
  /** Livre acesso. */
  freePass: boolean;
  /** Id do tipo de veículo. */
  vehicleTypeId: string;
  /** Tipo de veículo agregado (ou `null` se não resolvido). */
  vehicleType: VehicleTypeSummary | null;
  /** Se o veículo está ativo. */
  isActive: boolean;
}

/**
 * Resposta paginada de veículos — formato padrão do AGENTS.md §3 (`limit`,
 * `offset`, `data`, `count`, `parameters?`).
 */
export interface ListVehiclesResponse {
  /** Quantidade de registros retornados. */
  limit: number;
  /** Offset da página. */
  offset: number;
  /** Registros da página. */
  data: VehicleResponse[];
  /** Total de registros (sem paginação). */
  count: number;
  /** Metadados opcionais de filtros. */
  parameters?: ParameterDto[];
}
