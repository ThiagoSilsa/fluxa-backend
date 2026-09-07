// Constants
import type { EntryDenialReason } from '../../domain/constants/block.constant';

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
