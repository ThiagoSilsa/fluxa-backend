// Constants
import type {
  VehicleBlockStatus,
  VehicleBlockType,
} from '../constants/block.constant';

/**
 * Estado de bloqueio de um veículo — entidade de domínio.
 *
 * Espelha a tabela `vehicle_block` (migration `0003`; ADR 0006 §2/§10). É um
 * **histórico de estados**: nunca deletado e nunca alterado nos campos de
 * bloqueio após a criação; a única mutação é `status ACTIVE → REVOKED` +
 * preenchimento de `revoked_by`/`revoked_at`/`revoked_reason`.
 */
export interface VehicleBlockEntity {
  /** Id do bloqueio. */
  id: string;
  /** Empresa dona do bloqueio. */
  companyId: string;
  /** Veículo bloqueado (preenchido se cadastrado — vínculo por placa). */
  vehicleId: string | null;
  /** Placa normalizada (permite bloquear veículo não cadastrado). */
  plate: string;
  /** `MANUAL` (admin) / `AUTOMATIC` (sistema). */
  blockType: VehicleBlockType;
  /** Motivo (obrigatório — exibido ao porteiro). */
  reason: string;
  /** `ACTIVE` / `REVOKED`. */
  status: VehicleBlockStatus;
  /** Quem bloqueou (null apenas quando AUTOMATIC). */
  blockedBy: string | null;
  /** Quando bloqueou. */
  blockedAt: Date;
  /** Quem revogou (null = revogação automática). */
  revokedBy: string | null;
  /** Quando revogou. */
  revokedAt: Date | null;
  /** Motivo da revogação (obrigatório quando revogado). */
  revokedReason: string | null;
  /** Data de criação. */
  createdAt: Date;
  /** Data da última atualização. */
  updatedAt: Date;
}
