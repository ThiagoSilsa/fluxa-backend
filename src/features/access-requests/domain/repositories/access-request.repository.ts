// Constants
import type {
  AccessRequestStatus,
  ContactChannel,
} from '../constants/access-request.constant';

// Types
import type {
  AccessRequestEntity,
  AccessRequestPayload,
} from '../entities/access-request.entity';

/**
 * Symbol token de injeção do `AccessRequestRepository`.
 */
export const ACCESS_REQUEST_REPOSITORY = Symbol('ACCESS_REQUEST_REPOSITORY');

/**
 * Filtros de listagem de solicitações de acesso.
 */
export interface ListAccessRequestsRepositoryFilters {
  /** Filtra por status. */
  status?: AccessRequestStatus;
  /** Busca por placa (parcial). */
  plate?: string;
  /** Quantidade de registros por página. */
  limit: number;
  /** Offset da página. */
  offset: number;
}

/**
 * Dados para criação de solicitação de acesso.
 */
export interface CreateAccessRequestRepositoryData {
  companyId: string;
  /** Evita duplicar no sync (UNIQUE por empresa). */
  idempotencyKey: string;
  type: AccessRequestEntity['type'];
  /** Placa normalizada. */
  plate: string;
  /** Veículo existente (cenários NEW_USER/LINK). */
  vehicleId: string | null;
  /** Usuário existente (cenários NEW_VEHICLE/LINK). */
  userId: string | null;
  /** Porteiro que solicitou. */
  requestedBy: string;
  /** Canal de contato. */
  contactChannel: ContactChannel | null;
  /** Telefone de contato (whatsapp). */
  contactPhone: string | null;
  /** Departamento alvo (opcional). */
  departmentId: string | null;
  /** Dados para criar o que falta. */
  payload: AccessRequestPayload;
}

/**
 * Dados para transição de status/resolução da solicitação
 * (in_contact/reject/cancel/accept).
 */
export interface UpdateAccessRequestStatusRepositoryData {
  /** Novo status. */
  status: AccessRequestStatus;
  /** Admin que atendeu (null em cancelamento pelo porteiro). */
  handledBy?: string | null;
  /** Observação da avaliação. */
  observation?: string | null;
  /** Usuário criado/vinculado no aceite. */
  resolvedUserId?: string | null;
  /** Veículo criado/vinculado no aceite. */
  resolvedVehicleId?: string | null;
  /** Entrada temporária autorizada (aceite — ADR 0010 §4). */
  entryAuthorized?: boolean;
  /** Admin que autorizou a entrada (aceite). */
  authorizedBy?: string | null;
}

/**
 * Contrato do repositório de solicitações de acesso.
 *
 * Todas as operações são escopadas por `company_id` (sufixo `AndCompanyId`).
 * O `status_history` (jsonb) é a timeline `[{status, at, by}]` — o repositório
 * faz append a cada transição.
 */
export interface AccessRequestRepository {
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
  ): Promise<AccessRequestEntity | null>;

  /**
   * Busca a solicitação **aberta** da placa (`PENDING`/`IN_CONTACT` — unique
   * parcial `UQ_access_request_company_plate_open`), para duplicidade.
   *
   * @param plate Placa normalizada.
   * @param companyId Empresa da sessão.
   * @returns Solicitação aberta da placa ou `null`.
   */
  findOpenByPlateAndCompanyId(
    plate: string,
    companyId: string,
  ): Promise<AccessRequestEntity | null>;

  /**
   * Lista solicitações da empresa com paginação e filtros.
   *
   * @param companyId Empresa da sessão.
   * @param filters Filtros e paginação.
   * @returns Dados da página e total sem paginação.
   */
  list(
    companyId: string,
    filters: ListAccessRequestsRepositoryFilters,
  ): Promise<{ data: AccessRequestEntity[]; count: number }>;

  /**
   * Cria uma solicitação (`PENDING`) na empresa.
   *
   * @param data Dados de criação.
   * @returns Solicitação criada.
   */
  create(data: CreateAccessRequestRepositoryData): Promise<AccessRequestEntity>;

  /**
   * Transiciona o status de uma solicitação (append no `status_history`) e
   * aplica os campos opcionais de resolução/aceite quando informados.
   *
   * @param id Id da solicitação.
   * @param companyId Empresa da sessão.
   * @param data Novo status e campos de avaliação/resolução.
   * @returns Solicitação atualizada ou `null` se não existir/não pertencer.
   */
  updateStatusByIdAndCompanyId(
    id: string,
    companyId: string,
    data: UpdateAccessRequestStatusRepositoryData,
  ): Promise<AccessRequestEntity | null>;
}
