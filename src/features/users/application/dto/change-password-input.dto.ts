/**
 * Entrada do use case de troca de senha (já validada pelo controller).
 *
 * Troca **provisória** por `MANAGE_USERS` (ADR 0005 §6): a senha é da pessoa
 * (efeito cross-tenant), será substituída pela recuperação de senha.
 */
export class ChangePasswordInputDto {
  constructor(
    /** Id da pessoa. */
    readonly id: string,
    /** Nova senha em texto puro (mínimo 6 — validado no DTO de apresentação). */
    readonly newPassword: string,
  ) {}
}
