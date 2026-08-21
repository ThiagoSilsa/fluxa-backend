// Constants
import type {
  AccessStatus,
  MovementSource,
  MovementType,
  SyncStatus,
} from '../../domain/constants/access.constant';

// Types (bloqueios — a feature access consome o blocks no registro do
// impedimento automático — ADR 0010 §3)
import type { EntryDenialResponse } from '../../../blocks/application/dto/entry-denial-response';
/**
 * Resumo do impedimento registrado automaticamente (alias do contrato do
 * blocks — ADR 0010 §3).
 */
export type EntryDenialSummary = EntryDenialResponse;
/**
 * Visita de um veículo no formato de resposta (nunca a entidade crua —
 * AGENTS.md §3).
 */
export interface AccessResponse {
  /** Id da visita. */
  id: string;
  /** Veículo (NULL se não cadastrado — dados temporários). */
  vehicleId: string | null;
  /** Placa de veículo não cadastrado. */
  temporaryPlate: string | null;
  /** Condutor identificado. */
  driverUserId: string | null;
  /** Condutor não cadastrado. */
  temporaryDriverName: string | null;
  /** Setor confirmado na entrada. */
  departmentId: string | null;
  /** Solicitação que autorizou (ADR 0010 §4). */
  accessRequestId: string | null;
  /** Liberado mesmo com vaga cheia. */
  overCapacity: boolean;
  /** `INSIDE` / `OUT` / `NO_EXIT` / `MANUAL_CLOSED`. */
  status: AccessStatus;
  /** Saída forçada por reentrada. */
  forcedExit: boolean;
  /** Momento da entrada (ISO). */
  entryAt: string | null;
  /** Momento da saída (ISO). */
  exitAt: string | null;
  /** Quem encerrou. */
  closedBy: string | null;
  /** Quando encerrou (ISO). */
  closedAt: string | null;
}

/**
 * Evento de movimento no formato de resposta (ledger imutável).
 */
export interface MovementResponse {
  /** Id do evento. */
  id: string;
  /** Visita vinculada. */
  accessId: string | null;
  /** Veículo. */
  vehicleId: string | null;
  /** `ENTRY` / `EXIT`. */
  type: MovementType;
  /** Momento real do evento (ISO). */
  occurredAt: string;
  /** Placa lida no momento (snapshot). */
  plateSnapshot: string;
  /** Condutor identificado no momento. */
  driverUserId: string | null;
  /** Setor no momento do evento. */
  departmentId: string | null;
  /** Origem do movimento. */
  source: MovementSource;
  /** Portaria (device). */
  entranceId: string | null;
  /** Quem registrou. */
  doormanId: string | null;
  /** Status de sincronização. */
  syncStatus: SyncStatus;
}

/**
 * Visita + movimento (entrada registrada, saída registrada, reentrada).
 */
export interface ClosedAccessResponse {
  /** Visita (acesso). */
  access: AccessResponse;
  /** Movimento (ENTRY/EXIT). */
  movement: MovementResponse;
}

/**
 * Resposta do registro de entrada — `granted` discrimina liberação vs.
 * impedimento (ADR 0010 §3: ao negar, o entry_denial é registrado
 * automaticamente).
 */
export interface AccessEntryResponse {
  /** `true` = entrada liberada; `false` = impedimento (denial preenchido). */
  granted: boolean;
  /** Mensagem amigável para o client exibir. */
  message: string;
  /** Visita criada (quando liberada). */
  access?: AccessResponse;
  /** Movimento ENTRY (quando liberada). */
  movement?: MovementResponse;
  /** Acesso anterior encerrado por reentrada (quando houver). */
  previousClosed?: ClosedAccessResponse | null;
  /** Impedimento registrado automaticamente (quando negada). */
  denial?: EntryDenialResponse;
}

/**
 * Resposta do registro de saída.
 */
export interface AccessExitResponse {
  /** Acessos INSIDE encerrados (OUT) com seus movimentos EXIT. */
  closedAccesses: ClosedAccessResponse[];
  /** Saída sem entrada (NO_EXIT) — quando não havia INSIDE aberto. */
  noExit: ClosedAccessResponse | null;
}

/**
 * Acesso aberto (conferência na saída — quem entrou com o veículo).
 */
export interface OpenAccessResponse {
  /** Id da visita aberta. */
  id: string;
  /** Veículo (NULL se não cadastrado). */
  vehicleId: string | null;
  /** Placa temporária (não cadastrado). */
  temporaryPlate: string | null;
  /** Condutor da visita (id + nome resolvido). */
  driver: { id: string | null; name: string | null };
  /** Setor confirmado na entrada. */
  departmentId: string | null;
  /** Momento da entrada (ISO). */
  entryAt: string | null;
  /** Liberado excedendo a capacidade. */
  overCapacity: boolean;
}

/**
 * Ocupação por departamento.
 */
export interface OccupancyDepartmentResponse {
  /** Id do departamento. */
  departmentId: string;
  /** Nome do departamento. */
  name: string;
  /** Veículos dentro (INSIDE). */
  occupied: number;
  /** Vagas cadastradas. */
  capacity: number;
}

/**
 * Ocupação em tempo real (regra 21 — todos os veículos ocupam espaço).
 */
export interface OccupancyResponse {
  /** Veículos dentro no momento. */
  totalOccupied: number;
  /** Capacidade total (soma das vagas dos departamentos ativos). */
  totalCapacity: number;
  /** Vagas livres (capacidade − ocupação; mínimo 0). */
  freeSlots: number;
  /** Ocupação por departamento ativo. */
  byDepartment: OccupancyDepartmentResponse[];
}
