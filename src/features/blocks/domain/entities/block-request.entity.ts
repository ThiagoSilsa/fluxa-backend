// Constants
import type {
  BlockRequestStatus,
  SyncStatus,
} from '../constants/block.constant';

/**
 * Solicitação de bloqueio feita pelo porteiro — entidade de domínio.
 *
 * Espelha a tabela `block_request` (migration `0003`). O porteiro **solicita**
 * (motivo obrigatório); a administração **aprova** (cria o `vehicle_block`
 * MANUAL) ou **rejeita**; o porteiro pode **cancelar** a própria solicitação
 * em `PENDING`.
 */
export interface BlockRequestEntity {
  /** Id da solicitação. */
  id: string;
  /** Empresa dona da solicitação. */
  companyId: string;
  /** Veículo envolvido (preenchido se cadastrado). */
  vehicleId: string | null;
  /** Placa normalizada (permite veículo não cadastrado). */
  plate: string;
  /** Motivo (obrigatório). */
  reason: string;
  /** `PENDING` / `APPROVED` / `REJECTED` / `CANCELLED`. */
  status: BlockRequestStatus;
  /** Porteiro que solicitou. */
  requestedBy: string;
  /** Quando solicitou. */
  requestedAt: Date;
  /** Admin que avaliou. */
  handledBy: string | null;
  /** Quando avaliou. */
  handledAt: Date | null;
  /** Observação da avaliação. */
  observation: string | null;
  /** Timeline `[{status, at, by}]`. */
  statusHistory: unknown[];
  /** Bloqueio criado quando `APPROVED`. */
  resolvedBlockId: string | null;
  /** Resiliência offline do app. */
  syncStatus: SyncStatus;
  /** Evita duplicar no sync. */
  idempotencyKey: string;
  /** Data de criação. */
  createdAt: Date;
  /** Data da última atualização. */
  updatedAt: Date;
}
