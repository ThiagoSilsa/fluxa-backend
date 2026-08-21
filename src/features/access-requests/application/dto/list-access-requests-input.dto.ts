// Constants
import type { AccessRequestStatus } from '../../domain/constants/access-request.constant';

/**
 * Entrada do use case de listagem de solicitações de acesso.
 */
export class ListAccessRequestsInputDto {
  constructor(
    /** Filtro por status. */
    readonly status?: AccessRequestStatus,
    /** Busca por placa (parcial). */
    readonly plate?: string,
    /** Quantidade de registros por página. */
    readonly limit: number = 20,
    /** Offset da página. */
    readonly offset: number = 0,
  ) {}
}
