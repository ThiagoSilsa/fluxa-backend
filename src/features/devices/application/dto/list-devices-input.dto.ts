// Types
import type { DeviceSortBy } from '../../domain/repositories/device.repository';

/**
 * Entrada do use case de listagem de dispositivos (já validada pelo
 * controller).
 */
export class ListDevicesInputDto {
  constructor(
    /** Busca por nome (parcial, case-insensitive). */
    readonly search?: string,
    /** Filtro por estado ativo/inativo. */
    readonly isActive?: boolean,
    /** Coluna de ordenação (whitelist). */
    readonly sortBy?: DeviceSortBy,
    /** Direção da ordenação. */
    readonly sortOrder?: 'ASC' | 'DESC',
    /** Quantidade de registros por página. */
    readonly limit: number = 20,
    /** Offset da página. */
    readonly offset: number = 0,
  ) {}
}
