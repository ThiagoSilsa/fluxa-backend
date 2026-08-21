// Constants
import type {
  AccessRequestType,
  ContactChannel,
} from '../../domain/constants/access-request.constant';

// Types
import type { AccessRequestPayload } from '../../domain/entities/access-request.entity';

/**
 * Entrada do use case de criação de solicitação de acesso (já validada pelo
 * controller).
 */
export class CreateAccessRequestInputDto {
  constructor(
    /** Placa (normalizada na validação). */
    readonly plate: string,
    /** Cenário (`NEW_USER`/`NEW_VEHICLE`/`LINK`/`BOTH`). */
    readonly type: AccessRequestType,
    /** Veículo existente (cenários NEW_USER/LINK). */
    readonly vehicleId?: string,
    /** Usuário existente (cenários NEW_VEHICLE/LINK). */
    readonly userId?: string,
    /** Canal de contato. */
    readonly contactChannel?: ContactChannel,
    /** Telefone de contato (whatsapp). */
    readonly contactPhone?: string,
    /** Departamento alvo (opcional — só depto já criado). */
    readonly departmentId?: string,
    /** Dados para criar o que falta. */
    readonly payload: AccessRequestPayload = {},
  ) {}
}
