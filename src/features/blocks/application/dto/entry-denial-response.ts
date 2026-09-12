// Constants
import type {
  BlockRequestStatus,
  EntryDenialReason,
} from '../../domain/constants/block.constant';

/**
 * Impedimento de entrada no formato de resposta (ledger — nunca é alterado).
 */
export interface EntryDenialResponse {
  /** Id do impedimento. */
  id: string;
  /** Placa lida no momento (snapshot). */
  plateSnapshot: string;
  /** Veículo envolvido (preenchido se cadastrado). */
  vehicleId: string | null;
  /** Bloqueio que motivou (se houver). */
  blockId: string | null;
  /** Motivo do impedimento. */
  reason: EntryDenialReason;
  /** Observação livre do porteiro. */
  observation: string | null;
  /** Porteiro que impediu. */
  doormanId: string;
  /** Momento real do evento (ISO). */
  occurredAt: string;
}

/**
 * Pedido de bloqueio criado junto com o impedimento.
 */
export interface EntryDenialBlockRequestSummary {
  /** Id da solicitação de bloqueio. */
  id: string;
  /** Placa normalizada. */
  plate: string;
  /** `PENDING` (a administração aprova ou rejeita). */
  status: BlockRequestStatus;
}

/**
 * Resposta do registro de impedimento — o impedimento em si **mais** o
 * resultado do pedido de bloqueio, quando pedido.
 *
 * O shape do impedimento foi preservado (campos aditivos em vez de envelope
 * `{ denial, blockRequest }`) para não quebrar clientes existentes do
 * `POST /entry-denials`.
 */
export interface RegisterEntryDenialResponse extends EntryDenialResponse {
  /** Solicitação de bloqueio criada (`null` quando não pedida). */
  blockRequest: EntryDenialBlockRequestSummary | null;
  /**
   * Motivo pelo qual o pedido de bloqueio não foi criado (ex.: já existe
   * pendente para a placa). O impedimento **permanece** registrado.
   */
  blockRequestError: string | null;
}
