// Constants
import type { VehicleBlockStatus } from '../../domain/constants/block.constant';

/**
 * Entrada dos use cases que operam sobre um bloqueio específico (detalhar,
 * revogar) — carrega apenas o id.
 */
export class GetBlockInputDto {
  constructor(
    /** Id do bloqueio. */
    readonly blockId: string,
  ) {}
}

/**
 * Entrada do use case de listagem de bloqueios.
 */
export class ListBlocksInputDto {
  constructor(
    /** Busca por placa (parcial). */
    readonly search?: string,
    /** Filtro por status. */
    readonly status?: VehicleBlockStatus,
    /** Quantidade de registros por página. */
    readonly limit: number = 20,
    /** Offset da página. */
    readonly offset: number = 0,
  ) {}
}
