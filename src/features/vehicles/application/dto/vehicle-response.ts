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
 * Motorista no detalhe do veículo (detalhe agregado — ADR 0006 §11).
 */
export interface VehicleDriverResponse {
  /** Id do vínculo. */
  id: string;
  /** Motorista (id + nome). */
  user: { id: string; name: string };
  /** Proprietário principal do veículo. */
  isPrimary: boolean;
  /** Autorizado a dirigir. */
  canDrive: boolean;
}

/**
 * Veículo no formato de resposta (nunca a entidade crua do banco — AGENTS.md
 * §3). `isBlocked` é somente leitura (derivado do bloqueio — ADR 0006 §4).
 * `department`/`drivers` aparecem apenas no **detalhe** (`GET /vehicles/:id`).
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
  /** Departamento padrão ativo (detalhe) — id + nome, ou `null`. */
  department?: { id: string; name: string } | null;
  /** Motoristas vinculados (detalhe). */
  drivers?: VehicleDriverResponse[];
  /** Se o veículo está ativo. */
  isActive: boolean;
  /** Data de criação (ISO) — usada na ordenação da listagem (whitelist). */
  createdAt: string;
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
