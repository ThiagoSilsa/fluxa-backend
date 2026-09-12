// Constants
import type {
  AccessVerdict,
  AccessVerdictReason,
} from '../../domain/constants/access-verdict.constant';
import type { VehicleBlockType } from '../../../blocks/domain/constants/block.constant';
import type {
  AccessRequestStatus,
  AccessRequestType,
} from '../../../access-requests/domain/constants/access-request.constant';

// Types
import type { VehicleTypeSummary } from '../../../vehicles/application/dto/vehicle-response';

/**
 * Veículo da ficha de contexto (dados que o porteiro confere no balcão).
 */
export interface AccessContextVehicleResponse {
  /** Id do veículo. */
  id: string;
  /** Placa normalizada. */
  plate: string;
  /** Modelo (opcional). */
  model: string | null;
  /** Cor (opcional). */
  color: string | null;
  /** Id do tipo de veículo. */
  vehicleTypeId: string;
  /** Tipo de veículo agregado. */
  vehicleType: VehicleTypeSummary | null;
  /** Livre acesso (regra 3). */
  freePass: boolean;
  /** Se o veículo está ativo. */
  isActive: boolean;
  /** Derivado do bloqueio ativo (regra 17). */
  isBlocked: boolean;
}

/**
 * Bloqueio ativo que motiva uma negativa (regra 2).
 */
export interface AccessContextBlockResponse {
  /** Id do bloqueio. */
  id: string;
  /** Motivo (obrigatório — exibido ao porteiro). */
  reason: string;
  /** `MANUAL` (administração) / `AUTOMATIC` (sistema). */
  blockType: VehicleBlockType;
  /** Quando bloqueou (ISO). */
  blockedAt: string;
}

/**
 * Departamento considerado na ficha + ocupação **do setor escolhido**
 * (regra 27: o porteiro confirma o setor a cada entrada).
 */
export interface AccessContextDepartmentResponse {
  /** Setor considerado (informado ou padrão do veículo); `null` = vagas livres. */
  id: string | null;
  /** Nome do setor considerado. */
  name: string | null;
  /** Setor padrão ativo do veículo (para pré-seleção); `null` se não houver. */
  defaultId: string | null;
  /** Nome do setor padrão. */
  defaultName: string | null;
  /** Vagas cadastradas (0 = sem capacidade configurada). */
  capacity: number;
  /** Veículos dentro (INSIDE) no setor. */
  occupied: number;
  /** Há vaga livre (ou não há capacidade configurada). */
  hasFreeSlot: boolean;
}

/**
 * Motorista na ficha: vinculado ao veículo ou sugestão da empresa.
 */
export interface AccessContextDriverResponse {
  /** Id da pessoa (`user`). */
  id: string;
  /** Nome. */
  name: string;
  /** Vinculado ao veículo? */
  linked: boolean;
  /** Autorizado a dirigir (`can_drive`). */
  canDrive: boolean;
  /** Proprietário principal (1 por veículo). */
  isPrimary: boolean;
}

/**
 * Motoristas da ficha — vinculados (até 3, primário primeiro) e sugestões
 * (até 3, quando há busca).
 *
 * Nomes em português (`linkedDrivers`/`suggestions`) porque o shape é o
 * contrato do balcão: "motoristas vinculados" e "não vinculados" têm badge na
 * ficha.
 */
export interface AccessContextDriversResponse {
  /** Vinculados ao veículo (ou o escolhido, quando `driverUserId` informado). */
  linked: AccessContextDriverResponse[];
  /** Pessoas da empresa **sem** vínculo com o veículo (só com `search`). */
  suggestions: AccessContextDriverResponse[];
  /** Busca aplicada (eco). */
  search: string | null;
}

/**
 * Solicitação da placa (as últimas, qualquer status — regra 48).
 */
export interface AccessContextRequestResponse {
  /** Id da solicitação. */
  id: string;
  /** Cenário (`NEW_USER`/`NEW_VEHICLE`/`LINK`/`BOTH`). */
  type: AccessRequestType;
  /** Status (`PENDING`/`IN_CONTACT`/`REGISTERED`/`REJECTED`/`CANCELLED`). */
  status: AccessRequestStatus;
  /** Quando foi solicitada (ISO). */
  requestedAt: string;
  /** Pré-autorizada pela administração (sobrepõe o prazo — ADR 0014 §1). */
  entryAuthorized: boolean;
  /** Nome do motorista informado no `payload` (quando houver). */
  driverName: string | null;
  /** Vencida pelas regras 38/39 (`PENDING` > 3d; `IN_CONTACT` > 7d). */
  isOverdue: boolean;
  /** Dias corridos desde a solicitação (para a ficha dizer "há N dias"). */
  daysSinceRequest: number;
  /** Prazo-limite vigente (ISO) ou `null` para status sem prazo. */
  deadline: string | null;
}

/**
 * Acesso aberto (`INSIDE`) da placa — reentrada e conferência de saída.
 */
export interface AccessContextOpenAccessResponse {
  /** Id da visita aberta. */
  id: string;
  /** Quando entrou (ISO). */
  entryAt: string | null;
  /** Condutor (id + nome resolvido). */
  driver: { id: string | null; name: string | null };
  /** Setor confirmado na entrada. */
  departmentId: string | null;
  /** Liberado excedendo a capacidade. */
  overCapacity: boolean;
}

/**
 * Contexto + veredito da entrada (ADR 0014 §2) — **uma** resposta com tudo que
 * a portaria precisa decidir por uma placa.
 *
 * O cliente não recalcula regra alguma: ele exibe `verdict`/`reasons` e usa as
 * flags de requisito para montar o payload do `POST /access/entry`.
 */
export interface AccessContextResponse {
  /** Placa consultada (normalizada). */
  plate: string;
  /** Decisão única do servidor. */
  verdict: AccessVerdict;
  /** Motivos que compõem o veredito. */
  reasons: AccessVerdictReason[];
  /** A entrada exige criar/reaproveitar solicitação (bloco `request`). */
  requiresRequest: boolean;
  /**
   * Solicitação existente que pode ser **referenciada** (`accessRequestId`)
   * em vez de criar uma nova; `null` = criar (`request`).
   */
  reusableRequestId: string | null;
  /** A entrada exige confirmação `overCapacity` (409 sem ela). */
  requiresOverCapacity: boolean;
  /** Já existe acesso aberto (a saída anterior será encerrada — regra 9). */
  isReentry: boolean;
  /** Veículo cadastrado (ou `null` — placa desconhecida). */
  vehicle: AccessContextVehicleResponse | null;
  /** Bloqueio ativo (ou `null`). */
  block: AccessContextBlockResponse | null;
  /** Setor considerado + ocupação. */
  department: AccessContextDepartmentResponse;
  /** Motoristas vinculados e sugestões. */
  drivers: AccessContextDriversResponse;
  /** Últimas solicitações da placa (qualquer status). */
  requests: AccessContextRequestResponse[];
  /** Acessos abertos da placa. */
  openAccesses: AccessContextOpenAccessResponse[];
}
