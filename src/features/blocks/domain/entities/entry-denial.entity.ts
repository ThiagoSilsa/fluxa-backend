// Constants
import type {
  EntryDenialReason,
  SyncStatus,
} from '../constants/block.constant';

/**
 * Evento de impedimento de entrada — entidade de domínio.
 *
 * Espelha a tabela `entry_denial` (migration `0003`). É um **ledger
 * imutável** (append-only): nunca é deletado. Registrado pelo porteiro quando
 * impede a entrada (e, no access core, automaticamente pelo endpoint de
 * entrada ao negar — ADR 0010 §3).
 */
export interface EntryDenialEntity {
  /** Id do impedimento. */
  id: string;
  /** Empresa dona do evento. */
  companyId: string;
  /** Veículo envolvido (preenchido se cadastrado). */
  vehicleId: string | null;
  /** Placa lida no momento (snapshot). */
  plateSnapshot: string;
  /** Bloqueio que motivou (se houver). */
  blockId: string | null;
  /** Motivo do impedimento. */
  reason: EntryDenialReason;
  /** Observação livre do porteiro. */
  observation: string | null;
  /** Portaria (preenchida do device quando vinculado — app). */
  entranceId: string | null;
  /** Porteiro que impediu (obrigatório). */
  doormanId: string;
  /** Momento real do evento. */
  occurredAt: Date;
  /** Resiliência offline do app. */
  syncStatus: SyncStatus;
  /** Evita duplicar evento no sync. */
  idempotencyKey: string;
  /** Data de criação. */
  createdAt: Date;
  /** Data da última atualização. */
  updatedAt: Date;
}
