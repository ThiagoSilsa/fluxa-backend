// Constants
import type {
  AccessRequestStatus,
  AccessRequestType,
  ContactChannel,
} from '../constants/access-request.constant';

/**
 * Dados de criação enviados pelo porteiro no `payload` (jsonb).
 *
 * - `driver` — usado quando o motorista **não** está cadastrado
 *   (`NEW_USER`/`BOTH`): `name` e `email` obrigatórios (criar `user` exige
 *   e-mail único global); `document`/`phone` opcionais.
 * - `vehicle` — usado quando o veículo **não** está cadastrado
 *   (`NEW_VEHICLE`/`BOTH`): `model`/`color` opcionais. O **tipo** não fica no
 *   payload — a admin seleciona no aceite (regra 22).
 */
export interface AccessRequestPayload {
  /** Dados do motorista a criar (cenários NEW_USER/BOTH). */
  driver?: {
    /** Nome (obrigatório quando o usuário será criado). */
    name?: string;
    /** E-mail (obrigatório quando o usuário será criado — identidade global). */
    email?: string;
    /** Documento (opcional, único global). */
    document?: string | null;
    /** Telefone (opcional). */
    phone?: string | null;
  };
  /** Dados do veículo a criar (cenários NEW_VEHICLE/BOTH). */
  vehicle?: {
    /** Modelo (opcional). */
    model?: string;
    /** Cor (opcional). */
    color?: string;
  };
}

/**
 * Solicitação de acesso — entidade de domínio.
 *
 * Espelha a tabela `access_request` (migration `0005`; ADR 0010 §1 — M2; regras
 * §6). Criada pelo porteiro; aceite/rejeição são exclusivos da administração;
 * o porteiro pode cancelar a própria solicitação em `PENDING`. No aceite, a
 * administração **resolve retroativamente** os cadastros/vínculo
 * (`resolved_user_id`/`resolved_vehicle_id`) e autoriza a entrada
 * (`entry_authorized` — ADR 0010 §4).
 */
export interface AccessRequestEntity {
  /** Id da solicitação. */
  id: string;
  /** Empresa dona da solicitação. */
  companyId: string;
  /** Evita duplicar no sync (UNIQUE por empresa). */
  idempotencyKey: string;
  /** `NEW_USER` / `NEW_VEHICLE` / `LINK` / `BOTH`. */
  type: AccessRequestType;
  /** Placa normalizada (coluna própria p/ busca e duplicidade). */
  plate: string;
  /** Veículo existente (cenários `NEW_USER`/`LINK`). */
  vehicleId: string | null;
  /** Usuário existente (cenários `NEW_VEHICLE`/`LINK`). */
  userId: string | null;
  /** `PENDING` / `IN_CONTACT` / `REGISTERED` / `REJECTED` / `CANCELLED`. */
  status: AccessRequestStatus;
  /** Entrada temporária autorizada (ADR 0010 §4 — aceite/liberação). */
  entryAuthorized: boolean;
  /** Admin que autorizou a entrada. */
  authorizedBy: string | null;
  /** Quando autorizou. */
  authorizedAt: Date | null;
  /** Porteiro que solicitou. */
  requestedBy: string;
  /** Quando solicitou. */
  requestedAt: Date;
  /** Admin que atendeu (aceite/rejeição/in_contact). */
  handledBy: string | null;
  /** Quando atendeu. */
  handledAt: Date | null;
  /** Canal de contato. */
  contactChannel: ContactChannel | null;
  /** Telefone de contato (whatsapp) — obrigatório em NEW_USER/NEW_VEHICLE/BOTH. */
  contactPhone: string | null;
  /** Departamento alvo (só aceita depto já criado — regra 46). */
  departmentId: string | null;
  /** Dados para criar o que falta (ver `AccessRequestPayload`). */
  payload: AccessRequestPayload;
  /** Timeline `[{status, at, by}]`. */
  statusHistory: unknown[];
  /** Usuário criado/vinculado no aceite. */
  resolvedUserId: string | null;
  /** Veículo criado/vinculado no aceite. */
  resolvedVehicleId: string | null;
  /** Observação da avaliação. */
  observation: string | null;
  /** Data de criação. */
  createdAt: Date;
  /** Data da última atualização. */
  updatedAt: Date;
}
