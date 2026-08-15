// Constants
import { UserType } from '../../../auth/domain/constants/user-type.constant';

/**
 * Entrada do use case de listagem de usuários (já validada pelo controller).
 */
export class ListUsersInputDto {
  constructor(
    /** Busca por nome ou e-mail (parcial, case-insensitive). */
    readonly search?: string,
    /** Filtro por tipo no vínculo. */
    readonly type?: UserType,
    /** Filtro por vínculo ativo/inativo. */
    readonly isActive?: boolean,
    /** Quantidade de registros por página. */
    readonly limit: number = 20,
    /** Offset da página. */
    readonly offset: number = 0,
  ) {}
}
