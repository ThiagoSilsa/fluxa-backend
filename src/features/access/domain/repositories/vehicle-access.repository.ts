// Constants
import type { MovementSource, SyncStatus } from '../constants/access.constant';

// Types
import type { VehicleAccessEntity } from '../entities/vehicle-access.entity';
import type { VehicleMovementEntity } from '../entities/vehicle-movement.entity';

/**
 * Symbol token de injeção do `VehicleAccessRepository`.
 */
export const VEHICLE_ACCESS_REPOSITORY = Symbol('VEHICLE_ACCESS_REPOSITORY');

/**
 * Dados para criar uma entrada (INSIDE + movimento ENTRY).
 *
 * A reentrada (já INSIDE) é tratada **na mesma transação**: fecha o acesso
 * anterior com `forced_exit = true` + gera o movimento EXIT, depois cria o
 * novo INSIDE + movimento ENTRY (nunca 2 INSIDE — regra 9).
 */
export interface CreateEntryAccessRepositoryData {
  companyId: string;
  /** Veículo (preenchido se cadastrado). */
  vehicleId: string | null;
  /** Placa de veículo não cadastrado. */
  temporaryPlate: string | null;
  /** Placa lida no momento (snapshot do movimento ENTRY). */
  plateSnapshot: string;
  /** Condutor identificado. */
  driverUserId: string | null;
  /** Condutor não cadastrado (solicitação autorizada). */
  temporaryDriverName: string | null;
  /** Setor confirmado na entrada. */
  departmentId: string | null;
  /** Solicitação de acesso autorizada (ADR 0010 §4). */
  accessRequestId: string | null;
  /** Liberado mesmo com vaga cheia. */
  overCapacity: boolean;
  /** Origem do movimento (web → PLATE). */
  source: MovementSource;
  /** Portaria (null na web). */
  entranceId: string | null;
  /** Porteiro que registrou. */
  doormanId: string;
  /** `SYNCED` (web). */
  syncStatus: SyncStatus;
  /** Idempotência do movimento ENTRY. */
  idempotencyKey: string;
  /** Momento real do evento. */
  occurredAt: Date;
}

/**
 * Resultado de uma entrada registrada.
 */
export interface EntryResult {
  /** Visita criada (INSIDE). */
  access: VehicleAccessEntity;
  /** Movimento ENTRY criado. */
  movement: VehicleMovementEntity;
  /** Acesso anterior encerrado por reentrada (ou `null`). */
  previousClosed: {
    access: VehicleAccessEntity;
    movement: VehicleMovementEntity;
  } | null;
}

/**
 * Dados para encerrar acessos abertos e gerar os movimentos EXIT (saída).
 */
export interface CloseOpenAccessesRepositoryData {
  companyId: string;
  /** Ids dos acessos INSIDE a encerrar. */
  accessIds: string[];
  /** Placa lida no momento (snapshot). */
  plateSnapshot: string;
  /** Origem do movimento (web → PLATE). */
  source: MovementSource;
  /** Portaria (null na web). */
  entranceId: string | null;
  /** Porteiro que registrou. */
  doormanId: string;
  /** `SYNCED` (web). */
  syncStatus: SyncStatus;
  /** Idempotência do 1º movimento EXIT fechado (dedup de retry — M4). */
  idempotencyKey?: string;
  /** Momento real do evento. */
  occurredAt: Date;
}

/**
 * Dados para registrar saída sem entrada (`NO_EXIT` — regra 11).
 */
export interface CreateNoExitRepositoryData {
  companyId: string;
  /** Veículo (preenchido se cadastrado). */
  vehicleId: string | null;
  /** Placa de veículo não cadastrado. */
  temporaryPlate: string | null;
  /** Passageiro identificado. */
  driverUserId: string | null;
  /** Passageiro não cadastrado. */
  temporaryDriverName: string | null;
  /** Origem do movimento (web → PLATE). */
  source: MovementSource;
  /** Portaria (null na web). */
  entranceId: string | null;
  /** Porteiro que registrou. */
  doormanId: string;
  /** `SYNCED` (web). */
  syncStatus: SyncStatus;
  /** Idempotência do movimento EXIT. */
  idempotencyKey: string;
  /** Momento real do evento. */
  occurredAt: Date;
}

/**
 * Resultado de uma saída registrada.
 */
export interface ExitResult {
  /** Acessos INSIDE encerrados (OUT) com seus movimentos EXIT. */
  closedAccesses: {
    access: VehicleAccessEntity;
    movement: VehicleMovementEntity;
  }[];
  /** Saída sem entrada (NO_EXIT) — quando não havia INSIDE aberto. */
  noExit: {
    access: VehicleAccessEntity;
    movement: VehicleMovementEntity;
  } | null;
}

/**
 * Contrato do repositório de acessos (`vehicle_access`) e movimentos
 * (`vehicle_movement`).
 *
 * Todas as operações são escopadas por `company_id`. As escritas que mudam o
 * estado de um acesso **e** o ledger de movimentos rodam em **transação**
 * (nunca 2 INSIDE; ledger sempre consistente).
 */
export interface VehicleAccessRepository {
  /**
   * Lista os acessos `INSIDE` abertos de um veículo cadastrado.
   *
   * @param vehicleId Id do veículo.
   * @param companyId Empresa da sessão.
   * @returns Acessos abertos.
   */
  findOpenByVehicleIdAndCompanyId(
    vehicleId: string,
    companyId: string,
  ): Promise<VehicleAccessEntity[]>;

  /**
   * Lista os acessos `INSIDE` abertos por placa temporária (não cadastrado).
   *
   * @param plate Placa normalizada.
   * @param companyId Empresa da sessão.
   * @returns Acessos abertos.
   */
  findOpenByTemporaryPlateAndCompanyId(
    plate: string,
    companyId: string,
  ): Promise<VehicleAccessEntity[]>;

  /**
   * Registra uma entrada: fecha acessos INSIDE anteriores (reentrada — regra
   * 9), cria o novo acesso `INSIDE` e o movimento `ENTRY` — tudo na mesma
   * transação.
   *
   * @param data Dados da entrada.
   * @returns Entrada registrada.
   */
  createEntry(data: CreateEntryAccessRepositoryData): Promise<EntryResult>;

  /**
   * Busca um movimento pela chave de idempotência (M4 — dedup de retry/
   * sync). Permite devolver o resultado já persistido em vez de duplicar
   * quando o cliente reenvia a mesma operação offline.
   *
   * @param idempotencyKey Chave enviada pelo cliente (ou gerada pelo servidor).
   * @param companyId Empresa da sessão.
   * @returns Movimento encontrado ou `null`.
   */
  findMovementByIdempotencyKeyAndCompanyId(
    idempotencyKey: string,
    companyId: string,
  ): Promise<VehicleMovementEntity | null>;

  /**
   * Busca um acesso por id (usado no dedup para reconstruir o resultado já
   * persistido de uma operação repetida).
   *
   * @param id Id do acesso.
   * @param companyId Empresa da sessão.
   * @returns Acesso encontrado ou `null`.
   */
  findByIdAndCompanyId(
    id: string,
    companyId: string,
  ): Promise<VehicleAccessEntity | null>;

  /**
   * Encerra os acessos abertos informados (`OUT`) e gera os movimentos EXIT
   * na mesma transação (regra 10 — encerra todos os INSIDE do veículo).
   *
   * @param data Dados do encerramento.
   * @returns Acessos encerrados com seus movimentos EXIT.
   */
  closeOpenAndCreateExitMovements(
    data: CloseOpenAccessesRepositoryData,
  ): Promise<
    { access: VehicleAccessEntity; movement: VehicleMovementEntity }[]
  >;

  /**
   * Registra uma saída sem entrada (`NO_EXIT` + movimento EXIT) na mesma
   * transação (regra 11 — ledger completo).
   *
   * @param data Dados da saída sem entrada.
   * @returns Acesso NO_EXIT e movimento EXIT.
   */
  createNoExit(
    data: CreateNoExitRepositoryData,
  ): Promise<{ access: VehicleAccessEntity; movement: VehicleMovementEntity }>;

  /**
   * Conta os acessos `INSIDE` de um departamento (ocupação por setor).
   *
   * @param departmentId Id do departamento.
   * @param companyId Empresa da sessão.
   * @returns Quantidade de veículos dentro.
   */
  countInsideByDepartmentIdAndCompanyId(
    departmentId: string,
    companyId: string,
  ): Promise<number>;

  /**
   * Conta os acessos `INSIDE` da empresa (ocupação total).
   *
   * @param companyId Empresa da sessão.
   * @returns Quantidade de veículos dentro.
   */
  countInsideByCompanyId(companyId: string): Promise<number>;
}
