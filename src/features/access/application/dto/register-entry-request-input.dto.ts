// Constants
import type { AccessRequestType } from '../../../access-requests/domain/constants/access-request.constant';
import { UserType } from '../../../auth/domain/constants/user-type.constant';

// Types
import type { AccessRequestPayload } from '../../../access-requests/domain/entities/access-request.entity';

/**
 * Bloco `request` da entrada (ADR 0014 §5) — dados da solicitação que a
 * entrada cria **na mesma operação**, quando a liberação é uma exceção
 * (falta cadastro ou vínculo).
 *
 * O `vehicleId`/`userId` da solicitação não vêm daqui: o servidor preenche com
 * o veículo da placa e com o `driverUserId` informado na entrada, e o cenário
 * (`type`) é validado pelas regras da própria solicitação.
 */
export class RegisterEntryRequestInputDto {
  constructor(
    /** Cenário (`NEW_USER`/`NEW_VEHICLE`/`LINK`/`BOTH`). */
    readonly type: AccessRequestType,
    /** Tipo do usuário do motorista a criar (NEW_USER/BOTH) — default VISITOR. */
    readonly userType: UserType = UserType.VISITOR,
    /** Dados para criar o que falta (motorista e/ou veículo). */
    readonly payload: AccessRequestPayload = {},
    /** Telefone de contato (obrigatório fora do LINK — regra 43). */
    readonly contactPhone?: string,
    /** Departamento alvo (opcional). */
    readonly departmentId?: string,
  ) {}
}
