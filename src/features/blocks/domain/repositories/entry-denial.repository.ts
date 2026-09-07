// Constants
import type {
  EntryDenialReason,
  SyncStatus,
} from '../constants/block.constant';

// Types
import type { EntryDenialEntity } from '../entities/entry-denial.entity';

/**
 * Symbol token de injeção do `EntryDenialRepository`.
 */
export const ENTRY_DENIAL_REPOSITORY = Symbol('ENTRY_DENIAL_REPOSITORY');

/**
 * Dados para registro de impedimento de entrada (ledger, append-only).
 */
export interface CreateEntryDenialRepositoryData {
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
  /** Portaria (null na web — device do app). */
  entranceId: string | null;
  /** Porteiro que impediu. */
  doormanId: string;
  /** Momento real do evento. */
  occurredAt: Date;
  /** `SYNCED` (web) / `PENDING` (app offline). */
  syncStatus: SyncStatus;
  /** Evita duplicar evento no sync. */
  idempotencyKey: string;
}

/**
 * Contrato do repositório de impedimentos (`entry_denial` — ledger imutável).
 *
 * Todas as operações são escopadas por `company_id`. Append-only: o registro
 * de um impedimento nunca é alterado nem excluído.
 */
export interface EntryDenialRepository {
  /**
   * Registra um impedimento (append-only).
   *
   * @param data Dados do impedimento.
   * @returns Impedimento registrado.
   */
  create(data: CreateEntryDenialRepositoryData): Promise<EntryDenialEntity>;
}
