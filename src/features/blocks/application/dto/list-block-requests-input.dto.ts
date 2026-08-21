// Constants
import type { BlockRequestStatus } from '../../domain/constants/block.constant';

/**
 * Entrada dos use cases que operam sobre uma solicitação de bloqueio
 * específica (aprovar, rejeitar, cancelar).
 */
export class HandleBlockRequestInputDto {
  constructor(
    /** Id da solicitação. */
    readonly requestId: string,
    /** Observação da avaliação (opcional). */
    readonly observation?: string,
  ) {}
}

/**
 * Entrada do use case de listagem de solicitações de bloqueio.
 */
export class ListBlockRequestsInputDto {
  constructor(
    /** Filtro por status. */
    readonly status?: BlockRequestStatus,
    /** Quantidade de registros por página. */
    readonly limit: number = 20,
    /** Offset da página. */
    readonly offset: number = 0,
  ) {}
}
