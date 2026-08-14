/**
 * DTO de aplicação da troca de empresa — entrada já validada (o controller
 * converte o DTO de apresentação para este). Classe pura (AGENTS.md).
 */
export class SwitchCompanyInputDto {
  constructor(
    /** Id da empresa de destino da sessão. */
    readonly companyId: string,
  ) {}
}
