/**
 * DTO de aplicação do login — entrada já validada (o controller converte o
 * DTO de apresentação para este). Classe pura, sem decorators (AGENTS.md).
 */
export class LoginInputDto {
  constructor(
    /** E-mail da pessoa (identidade global). */
    readonly email: string,
    /** Senha em texto puro. */
    readonly password: string,
    /** Empresa escolhida (opcional — multi-empresa, ADR 0002). */
    readonly companyId?: string,
  ) {}
}
