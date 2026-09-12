/**
 * Tipo de movimento (enum `movement_type` do Postgres — migration `0004`).
 * Ledger imutável: o tipo nunca muda após a criação.
 */
export enum MovementType {
  ENTRY = 'ENTRY',
  EXIT = 'EXIT',
}

/**
 * Origem do movimento (enum `movement_source` — migration `0004`).
 *
 * Server-side (ADR 0010 §6): web/placa → `PLATE`; QR → `QRCODE`; app → `APP`;
 * admin manual → `MANUAL`; entrada inicial (go-live) → `INITIAL`.
 */
export enum MovementSource {
  APP = 'APP',
  WEB = 'WEB',
  QRCODE = 'QRCODE',
  PLATE = 'PLATE',
  INITIAL = 'INITIAL',
  MANUAL = 'MANUAL',
}

/**
 * Estado da visita (enum `access_status` — migration `0004`).
 *
 * - `INSIDE` — veículo dentro (acesso aberto);
 * - `OUT` — saída registrada;
 * - `NO_EXIT` — saída registrada sem entrada (ledger completo);
 * - `MANUAL_CLOSED` — encerrado manualmente pela administração.
 */
export enum AccessStatus {
  INSIDE = 'INSIDE',
  OUT = 'OUT',
  NO_EXIT = 'NO_EXIT',
  MANUAL_CLOSED = 'MANUAL_CLOSED',
}

/**
 * Tipo de registro no feed da portaria (ADR 0015): entradas e saídas vêm do
 * ledger `vehicle_movement`; impedimentos do ledger `entry_denial`.
 */
export enum AccessRecordKind {
  ENTRY = 'ENTRY',
  EXIT = 'EXIT',
  DENIAL = 'DENIAL',
}

/**
 * Status de sincronização offline (enum `sync_status` — migration `0003`).
 * `SYNCED` = criado/confirmado no servidor (web).
 */
export enum SyncStatus {
  PENDING = 'PENDING',
  SYNCED = 'SYNCED',
}
