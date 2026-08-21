// Constants
import type {
  BlockRequestStatus,
  SyncStatus,
} from '../constants/block.constant';

// Types
import type { BlockRequestEntity } from '../entities/block-request.entity';

/**
 * Symbol token de injeção do `BlockRequestRepository`.
 */
export const BLOCK_REQUEST_REPOSITORY = Symbol('BLOCK_REQUEST_REPOSITORY');

/**
 * Filtros de listagem de solicitações de bloqueio.
 */
export interface ListBlockRequestsRepositoryFilters {
  /** Filtra por status. */
  status?: BlockRequestStatus;
  /** Filtra pelo porteiro que solicitou (opcional — "minhas"). */
  requestedBy?: string;
  /** Quantidade de registros por página. */
  limit: number;
  /** Offset da página. */
  offset: number;
}

/**
 * Dados para criação de solicitação de bloqueio.
 */
export interface CreateBlockRequestRepositoryData {
  companyId: string;
  /** Veículo envolvido (preenchido se cadastrado). */
  vehicleId: string | null;
  /** Placa normalizada. */
  plate: string;
  /** Motivo (obrigatório). */
  reason: string;
  /** Porteiro que solicitou. */
  requestedBy: string;
  /** `SYNCED` (web) / `PENDING` (app offline). */
  syncStatus: SyncStatus;
  /** Evita duplicar no sync. */
  idempotencyKey: string;
}

/**
 * Dados para transição de status da solicitação (approve/reject/cancel).
 */
export interface UpdateBlockRequestStatusRepositoryData {
  /** Novo status. */
  status: BlockRequestStatus;
  /** Admin que avaliou (null em cancelamento pelo porteiro). */
  handledBy?: string | null;
  /** Observação da avaliação. */
  observation?: string | null;
  /** Bloqueio criado quando `APPROVED`. */
  resolvedBlockId?: string | null;
}

/**
 * Contrato do repositório de solicitações de bloqueio.
 *
 * Todas as operações são escopadas por `company_id` (sufixo `AndCompanyId`).
 * O `status_history` (jsonb) é a timeline `[{status, at, by}]` — o repositório
 * faz append a cada transição.
 */
export interface BlockRequestRepository {
  /**
   * Busca uma solicitação por id dentro da empresa.
   *
   * @param id Id da solicitação.
   * @param companyId Empresa da sessão.
   * @returns Solicitação da empresa ou `null` se não existir/não pertencer.
   */
  findByIdAndCompanyId(
    id: string,
    companyId: string,
  ): Promise<BlockRequestEntity | null>;

  /**
   * Busca a solicitação **pendente** da placa (unique parcial — evita pedido
   * duplicado em aberto).
   *
   * @param plate Placa normalizada.
   * @param companyId Empresa da sessão.
   * @returns Solicitação pendente da placa ou `null`.
   */
  findPendingByPlateAndCompanyId(
    plate: string,
    companyId: string,
  ): Promise<BlockRequestEntity | null>;

  /**
   * Lista solicitações da empresa com paginação e filtros.
   *
   * @param companyId Empresa da sessão.
   * @param filters Filtros e paginação.
   * @returns Dados da página e total sem paginação.
   */
  list(
    companyId: string,
    filters: ListBlockRequestsRepositoryFilters,
  ): Promise<{ data: BlockRequestEntity[]; count: number }>;

  /**
   * Cria uma solicitação (`PENDING`) na empresa.
   *
   * @param data Dados de criação.
   * @returns Solicitação criada.
   */
  create(data: CreateBlockRequestRepositoryData): Promise<BlockRequestEntity>;

  /**
   * Transiciona o status de uma solicitação (append no `status_history`).
   *
   * @param id Id da solicitação.
   * @param companyId Empresa da sessão.
   * @param data Novos status/campos de avaliação.
   * @returns Solicitação atualizada ou `null` se não existir/não pertencer.
   */
  updateStatusByIdAndCompanyId(
    id: string,
    companyId: string,
    data: UpdateBlockRequestStatusRepositoryData,
  ): Promise<BlockRequestEntity | null>;
}
