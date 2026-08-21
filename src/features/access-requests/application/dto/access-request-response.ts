// Constants
import type {
  AccessRequestStatus,
  AccessRequestType,
  ContactChannel,
} from '../../domain/constants/access-request.constant';

// Types
import type { AccessRequestPayload } from '../../domain/entities/access-request.entity';

/**
 * Resumo de um ator (porteiro que solicitou / admin que atendeu/autorizou).
 */
export interface AccessRequestActorSummary {
  /** Id do usuário. */
  id: string;
  /** Nome do usuário. */
  name: string;
}

/**
 * Solicitação de acesso no formato de resposta (nunca a entidade crua —
 * AGENTS.md §3).
 */
export interface AccessRequestResponse {
  /** Id da solicitação. */
  id: string;
  /** `NEW_USER` / `NEW_VEHICLE` / `LINK` / `BOTH`. */
  type: AccessRequestType;
  /** Placa normalizada. */
  plate: string;
  /** Veículo existente (cenários NEW_USER/LINK). */
  vehicleId: string | null;
  /** Usuário existente (cenários NEW_VEHICLE/LINK). */
  userId: string | null;
  /** `PENDING` / `IN_CONTACT` / `REGISTERED` / `REJECTED` / `CANCELLED`. */
  status: AccessRequestStatus;
  /** Entrada temporária autorizada (aceite — ADR 0010 §4). */
  entryAuthorized: boolean;
  /** Porteiro que solicitou. */
  requestedBy: AccessRequestActorSummary;
  /** Quando solicitou (ISO). */
  requestedAt: string;
  /** Admin que atendeu (aceite/rejeição/in_contact) ou null. */
  handledBy: AccessRequestActorSummary | null;
  /** Quando atendeu (ISO) ou null. */
  handledAt: string | null;
  /** Admin que autorizou a entrada ou null. */
  authorizedBy: AccessRequestActorSummary | null;
  /** Quando autorizou (ISO) ou null. */
  authorizedAt: string | null;
  /** Canal de contato. */
  contactChannel: ContactChannel | null;
  /** Telefone de contato (whatsapp). */
  contactPhone: string | null;
  /** Departamento alvo (só aceita depto já criado). */
  departmentId: string | null;
  /** Dados para criar o que falta. */
  payload: AccessRequestPayload;
  /** Timeline `[{status, at, by}]`. */
  statusHistory: unknown[];
  /** Usuário criado/vinculado no aceite. */
  resolvedUserId: string | null;
  /** Veículo criado/vinculado no aceite. */
  resolvedVehicleId: string | null;
  /** Observação da avaliação. */
  observation: string | null;
  /** Data de criação (ISO). */
  createdAt: string;
}

/**
 * Resposta paginada de solicitações — formato padrão do AGENTS.md §3.
 */
export interface ListAccessRequestsResponse {
  /** Quantidade de registros retornados. */
  limit: number;
  /** Offset da página. */
  offset: number;
  /** Registros da página. */
  data: AccessRequestResponse[];
  /** Total de registros (sem paginação). */
  count: number;
}
