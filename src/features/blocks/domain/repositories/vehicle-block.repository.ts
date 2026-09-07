// Constants
import type {
  VehicleBlockStatus,
  VehicleBlockType,
} from '../constants/block.constant';

// Types
import type { VehicleBlockEntity } from '../entities/vehicle-block.entity';

/**
 * Symbol token de injeção do `VehicleBlockRepository`.
 */
export const VEHICLE_BLOCK_REPOSITORY = Symbol('VEHICLE_BLOCK_REPOSITORY');

/**
 * Filtros de listagem de bloqueios.
 */
export interface ListVehicleBlocksRepositoryFilters {
  /** Busca por placa (parcial). */
  search?: string;
  /** Filtra por status. */
  status?: VehicleBlockStatus;
  /** Quantidade de registros por página. */
  limit: number;
  /** Offset da página. */
  offset: number;
}

/**
 * Dados para criação de bloqueio.
 */
export interface CreateVehicleBlockRepositoryData {
  companyId: string;
  /** Veículo vinculado (null = placa de veículo não cadastrado). */
  vehicleId: string | null;
  /** Placa normalizada. */
  plate: string;
  blockType: VehicleBlockType;
  /** Motivo (obrigatório — exibido ao porteiro). */
  reason: string;
  /** Quem bloqueou (null apenas quando AUTOMATIC). */
  blockedBy: string | null;
}

/**
 * Dados para revogação de bloqueio.
 */
export interface RevokeVehicleBlockRepositoryData {
  /** Quem revogou. */
  revokedBy: string;
  /** Motivo da revogação (obrigatório). */
  revokedReason: string;
}

/**
 * Contrato do repositório de bloqueios de veículos.
 *
 * Todas as operações são escopadas por `company_id` (sufixo `AndCompanyId`).
 * As escritas que alteram `vehicle.is_blocked` (derivado — ADR 0010 §2) rodam
 * em **transação** com o bloqueio (este repositório é o dono da manutenção da
 * coluna). Bloqueio por placa de veículo não cadastrado é **vinculado pela
 * placa** quando o veículo passa a existir (regra 19) — de forma preguiçosa,
 * na busca ativa.
 */
export interface VehicleBlockRepository {
  /**
   * Busca um bloqueio por id dentro da empresa.
   *
   * @param id Id do bloqueio.
   * @param companyId Empresa da sessão.
   * @returns Bloqueio da empresa ou `null` se não existir/não pertencer.
   */
  findByIdAndCompanyId(
    id: string,
    companyId: string,
  ): Promise<VehicleBlockEntity | null>;

  /**
   * Busca o bloqueio **ativo** do veículo cadastrado (unique parcial).
   *
   * @param vehicleId Id do veículo.
   * @param companyId Empresa da sessão.
   * @returns Bloqueio ativo do veículo ou `null`.
   */
  findActiveByVehicleIdAndCompanyId(
    vehicleId: string,
    companyId: string,
  ): Promise<VehicleBlockEntity | null>;

  /**
   * Busca o bloqueio **ativo** pela placa (veículo cadastrado ou não) e, se o
   * veículo já estiver cadastrado, **vincula o bloqueio pela placa** (regra
   * 19 — preenche `vehicle_id` + `is_blocked`, sem revogar) em transação.
   *
   * Usado pelo access core (M3) para checar "veículo proibido" e aqui para
   * detectar bloqueio ativo por placa/veículo.
   *
   * @param plate Placa normalizada.
   * @param companyId Empresa da sessão.
   * @returns Bloqueio ativo (resolvido/linkado) ou `null`.
   */
  findActiveByPlateAndCompanyId(
    plate: string,
    companyId: string,
  ): Promise<VehicleBlockEntity | null>;

  /**
   * Lista bloqueios da empresa com paginação e filtro de status/placa.
   *
   * @param companyId Empresa da sessão.
   * @param filters Filtros e paginação.
   * @returns Dados da página e total sem paginação.
   */
  list(
    companyId: string,
    filters: ListVehicleBlocksRepositoryFilters,
  ): Promise<{ data: VehicleBlockEntity[]; count: number }>;

  /**
   * Cria um bloqueio ativo e, se houver veículo vinculado, seta
   * `vehicle.is_blocked = true` **na mesma transação** (ADR 0010 §2).
   *
   * @param data Dados de criação.
   * @returns Bloqueio criado.
   */
  create(data: CreateVehicleBlockRepositoryData): Promise<VehicleBlockEntity>;

  /**
   * Revoga um bloqueio ativo (`ACTIVE → REVOKED` + motivo) e recalcula
   * `vehicle.is_blocked` (false se não restar bloqueio ativo) **na mesma
   * transação** (ADR 0010 §2).
   *
   * @param id Id do bloqueio.
   * @param companyId Empresa da sessão.
   * @param data Dados de revogação.
   * @returns Bloqueio revogado ou `null` se não existir/não pertencer.
   */
  revokeByIdAndCompanyId(
    id: string,
    companyId: string,
    data: RevokeVehicleBlockRepositoryData,
  ): Promise<VehicleBlockEntity | null>;
}
