/**
 * Entrada do use case de aceite de solicitação de acesso (resolução
 * retroativa + liberação da entrada).
 */
export class AcceptAccessRequestInputDto {
  constructor(
    /** Id da solicitação. */
    readonly requestId: string,
    /** Tipo do veículo a criar (obrigatório em NEW_VEHICLE/BOTH — regra 22). */
    readonly vehicleTypeId?: string,
    /** Pode dirigir (default true — regra 42). */
    readonly canDrive: boolean = true,
    /** Vínculo primário (opcional — apenas 1 primário por veículo). */
    readonly isPrimary: boolean = false,
    /** Observação da avaliação. */
    readonly observation?: string,
    /**
     * Cargo a vincular quando o motorista for **Colaborador** (`user_type =
     * EMPLOYEE`) — obrigatório nesse caso (ADR 0013 §4).
     */
    readonly roleId?: string,
    /**
     * Senha do **Colaborador** (`user_type = EMPLOYEE`) — obrigatória nesse
     * caso (ADR 0013 §4). Ignorada para Visitante.
     */
    readonly password?: string,
  ) {}
}
