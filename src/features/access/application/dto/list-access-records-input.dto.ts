// Constants
import type { AccessRecordKind } from '../../domain/constants/access.constant';

/**
 * Entrada do use case do feed de registros da portaria (já validada pelo
 * controller).
 */
export class ListAccessRecordsInputDto {
  constructor(
    /** Filtra por tipo de registro (`ENTRY`/`EXIT`/`DENIAL`). */
    readonly kind?: AccessRecordKind,
    /** Busca por placa (parcial, normalizada na aplicação). */
    readonly plate?: string,
    /** Início do período (ISO). */
    readonly dateFrom?: Date,
    /** Fim do período (ISO). */
    readonly dateTo?: Date,
    /** Portaria do device. */
    readonly entranceId?: string,
    /** Porteiro que registrou. */
    readonly doormanId?: string,
    /** Quantidade de registros por página. */
    readonly limit: number = 20,
    /** Offset da página. */
    readonly offset: number = 0,
  ) {}
}
