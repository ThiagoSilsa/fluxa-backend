// Constants
import { UserType } from '../../../auth/domain/constants/user-type.constant';

/**
 * Entrada do use case de criação de usuário (já validada pelo controller).
 *
 * `name`/`password` são opcionais aqui porque o use case decide conforme o
 * caso: pessoa nova exige ambos; pessoa já existente **proíbe** ambos (e
 * também `phone`/`document`) — ADR 0005 §2.
 */
export class CreateUserInputDto {
  constructor(
    /** E-mail (identidade global — normalizado no use case). */
    readonly email: string,
    /** Tipo no vínculo (EMPLOYEE/VISITOR — obrigatório). */
    readonly type: UserType = UserType.EMPLOYEE,
    /** Nome da pessoa (obrigatório quando a pessoa é nova; proibido no vínculo). */
    readonly name?: string,
    /** Senha em texto puro (obrigatória quando a pessoa é nova; proibida no vínculo). */
    readonly password?: string,
    /** Telefone (proibido no vínculo de pessoa existente). */
    readonly phone?: string,
    /** Documento (proibido no vínculo de pessoa existente). */
    readonly document?: string,
    /** Cargo a vincular já na criação (1 cargo por empresa — ADR 0005 §5). */
    readonly roleId?: string,
  ) {}
}
