// Constants
import type { BlockRequestStatus } from '../../domain/constants/block.constant';

/**
 * Resumo do ator (porteiro que solicitou / admin que avaliou).
 */
export interface BlockRequestActorSummary {
  /** Id do usuário. */
  id: string;
  /** Nome do usuário. */
  name: string;
}

/**
 * Solicitação de bloqueio no formato de resposta (nunca a entidade crua —
 * AGENTS.md §3).
 */
export interface BlockRequestResponse {
  /** Id da solicitação. */
  id: string;
  /** Placa normalizada. */
  plate: string;
  /** Veículo envolvido (preenchido se cadastrado). */
  vehicleId: string | null;
  /** Motivo. */
  reason: string;
  /** `PENDING` / `APPROVED` / `REJECTED` / `CANCELLED`. */
  status: BlockRequestStatus;
  /** Porteiro que solicitou. */
  requestedBy: BlockRequestActorSummary;
  /** Quando solicitou (ISO). */
  requestedAt: string;
  /** Admin que avaliou ou null. */
  handledBy: BlockRequestActorSummary | null;
  /** Quando avaliou (ISO) ou null. */
  handledAt: string | null;
  /** Observação da avaliação ou null. */
  observation: string | null;
  /** Timeline `[{status, at, by}]`. */
  statusHistory: unknown[];
  /** Bloqueio criado quando `APPROVED`. */
  resolvedBlockId: string | null;
  /** Data de criação (ISO). */
  createdAt: string;
}

/**
 * Resposta paginada de solicitações — formato padrão do AGENTS.md §3.
 */
export interface ListBlockRequestsResponse {
  /** Quantidade de registros retornados. */
  limit: number;
  /** Offset da página. */
  offset: number;
  /** Registros da página. */
  data: BlockRequestResponse[];
  /** Total de registros (sem paginação). */
  count: number;
}
