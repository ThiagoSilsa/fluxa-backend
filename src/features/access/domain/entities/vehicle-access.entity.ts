// Constants
import type { AccessStatus } from '../constants/access.constant';

/**
 * Estado da visita de um veículo — entidade de domínio.
 *
 * Espelha a tabela `vehicle_access` (migration `0004`; ADR 0010 §6). Um
 * veículo **nunca tem 2 acessos INSIDE** ao mesmo tempo — a reentrada encerra
 * o anterior com `forced_exit = true` (regra 9).
 */
export interface VehicleAccessEntity {
  /** Id da visita. */
  id: string;
  /** Empresa dona da visita. */
  companyId: string;
  /** Veículo (NULL se não cadastrado — dados temporários). */
  vehicleId: string | null;
  /** Placa de veículo não cadastrado. */
  temporaryPlate: string | null;
  /** Condutor identificado (usuário cadastrado). */
  driverUserId: string | null;
  /** Condutor não cadastrado. */
  temporaryDriverName: string | null;
  /** Setor confirmado na entrada. */
  departmentId: string | null;
  /** Solicitação de acesso que autorizou (ADR 0010 §4). */
  accessRequestId: string | null;
  /** Liberado mesmo com vaga cheia. */
  overCapacity: boolean;
  /** `INSIDE` / `OUT` / `NO_EXIT` / `MANUAL_CLOSED`. */
  status: AccessStatus;
  /** Saída forçada por reentrada. */
  forcedExit: boolean;
  /** Momento da entrada. */
  entryAt: Date | null;
  /** Momento da saída. */
  exitAt: Date | null;
  /** Quem encerrou (admin em MANUAL_CLOSED). */
  closedBy: string | null;
  /** Quando encerrou. */
  closedAt: Date | null;
  /** Data de criação. */
  createdAt: Date;
  /** Data da última atualização. */
  updatedAt: Date;
}
