/**
 * Tipo de bloqueio (enum `vehicle_block_type` do Postgres — migration `0003`).
 * `MANUAL` = administração; `AUTOMATIC` = sistema (bloqueio automático por
 * prazo de solicitação — integração futura).
 */
export enum VehicleBlockType {
  MANUAL = 'MANUAL',
  AUTOMATIC = 'AUTOMATIC',
}

/**
 * Status de um bloqueio (enum `vehicle_block_status` — migration `0003`).
 * Histórico de estados: a única mutação permitida é `ACTIVE → REVOKED`.
 */
export enum VehicleBlockStatus {
  ACTIVE = 'ACTIVE',
  REVOKED = 'REVOKED',
}

/**
 * Motivos de impedimento de entrada (enum `entry_denial_reason` — migration
 * `0003`).
 */
export enum EntryDenialReason {
  BLOCKED = 'BLOCKED',
  UNREGISTERED = 'UNREGISTERED',
  UNAUTHORIZED_DRIVER = 'UNAUTHORIZED_DRIVER',
  OTHER = 'OTHER',
}

/**
 * Status de um pedido de bloqueio (enum `block_request_status` — migration
 * `0003`).
 */
export enum BlockRequestStatus {
  PENDING = 'PENDING',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
  CANCELLED = 'CANCELLED',
}

/**
 * Status de sincronização offline (enum `sync_status` — migration `0003`).
 * `SYNCED` = criado/confirmado no servidor; `PENDING` = criado no app offline
 * (fase 3) aguardando sync.
 */
export enum SyncStatus {
  PENDING = 'PENDING',
  SYNCED = 'SYNCED',
}
