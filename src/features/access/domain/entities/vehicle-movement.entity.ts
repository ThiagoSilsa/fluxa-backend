// Constants
import type {
  MovementSource,
  MovementType,
  SyncStatus,
} from '../constants/access.constant';

/**
 * Evento de movimento (entrada/saída) — entidade de domínio.
 *
 * Espelha a tabela `vehicle_movement` (migration `0004`). É um **ledger
 * imutável**: `type`/`plate_snapshot` nunca mudam (sobrevivem a mudanças de
 * cadastro). Cada evento carrega `idempotency_key` (UNIQUE por empresa) para
 * a resiliência offline do app (ADR 0010 §5).
 */
export interface VehicleMovementEntity {
  /** Id do evento. */
  id: string;
  /** Empresa dona do evento. */
  companyId: string;
  /** Visita vinculada (`vehicle_access`). */
  accessId: string | null;
  /** Veículo (NULL se ainda não cadastrado). */
  vehicleId: string | null;
  /** `ENTRY` / `EXIT` — imutável. */
  type: MovementType;
  /** Momento real do evento. */
  occurredAt: Date;
  /** Placa lida no momento (snapshot). */
  plateSnapshot: string;
  /** Condutor identificado no momento. */
  driverUserId: string | null;
  /** Setor no momento do evento. */
  departmentId: string | null;
  /** Origem do movimento (PLATE/QRCODE/APP/MANUAL/INITIAL/WEB). */
  source: MovementSource;
  /** Portaria (preenchida do device — app). */
  entranceId: string | null;
  /** Quem registrou. */
  doormanId: string | null;
  /** Resiliência offline do app. */
  syncStatus: SyncStatus;
  /** Evita duplicar no sync (UNIQUE por empresa). */
  idempotencyKey: string;
  /** Data de criação. */
  createdAt: Date;
  /** Data da última atualização. */
  updatedAt: Date;
}
