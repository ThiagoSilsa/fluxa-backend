// Constants
import { UserType } from '../../../auth/domain/constants/user-type.constant';

/**
 * Entrada do use case de edição de usuário (já validada pelo controller).
 *
 * Edição **parcial** (ADR 0005 §3): dados da pessoa (`name`, `email`,
 * `phone`, `document`, `observation`) refletem em todas as empresas; dados do
 * vínculo (`type`, `is_active`) afetam só a empresa da sessão. Senha nunca é
 * editada por PATCH — há fluxo próprio (troca de senha).
 */
export class UpdateUserInputDto {
  constructor(
    /** Id da pessoa. */
    readonly id: string,
    /** Nome (dado da pessoa — reflete em todas as empresas). */
    readonly name?: string,
    /** E-mail (dado da pessoa — normalizado; 409 se já existir). */
    readonly email?: string,
    /** Telefone (dado da pessoa). */
    readonly phone?: string,
    /** Documento (dado da pessoa — 409 se já existir). */
    readonly document?: string,
    /** Observação (dado da pessoa). */
    readonly observation?: string,
    /** Tipo no vínculo (só afeta a empresa da sessão). */
    readonly type?: UserType,
    /** Ativo/inativo do vínculo (sujeito à invariante do último admin). */
    readonly isActive?: boolean,
  ) {}
}
