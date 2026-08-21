// Constants
import type {
  VehicleBlockStatus,
  VehicleBlockType,
} from '../../domain/constants/block.constant';

/**
 * Resumo do ator (quem bloqueou/revogou).
 */
export interface BlockActorSummary {
  /** Id do usuário. */
  id: string;
  /** Nome do usuário. */
  name: string;
}

/**
 * Bloqueio de veículo no formato de resposta (nunca a entidade crua — AGENTS.md
 * §3). `is_blocked` do veículo é derivado e mantido por esta feature (ADR 0010
 * §2).
 */
export interface BlockResponse {
  /** Id do bloqueio. */
  id: string;
  /** Placa normalizada. */
  plate: string;
  /** Veículo bloqueado (preenchido se cadastrado). */
  vehicleId: string | null;
  /** `MANUAL` / `AUTOMATIC`. */
  blockType: VehicleBlockType;
  /** Motivo (exibido ao porteiro). */
  reason: string;
  /** `ACTIVE` / `REVOKED`. */
  status: VehicleBlockStatus;
  /** Quem bloqueou. */
  blockedBy: BlockActorSummary | null;
  /** Quando bloqueou (ISO). */
  blockedAt: string;
  /** Quem revogou. */
  revokedBy: BlockActorSummary | null;
  /** Quando revogou (ISO) ou null. */
  revokedAt: string | null;
  /** Motivo da revogação ou null. */
  revokedReason: string | null;
  /** Data de criação (ISO). */
  createdAt: string;
}

/**
 * Resposta paginada de bloqueios — formato padrão do AGENTS.md §3.
 */
export interface ListBlocksResponse {
  /** Quantidade de registros retornados. */
  limit: number;
  /** Offset da página. */
  offset: number;
  /** Registros da página. */
  data: BlockResponse[];
  /** Total de registros (sem paginação). */
  count: number;
}
