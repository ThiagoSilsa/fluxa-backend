// Types
import type { AccessRecordKind } from '../constants/access.constant';
import type { AccessRecordEntity } from '../entities/access-record.entity';

/**
 * Symbol token de injeção do `AccessRecordRepository`.
 */
export const ACCESS_RECORD_REPOSITORY = Symbol('ACCESS_RECORD_REPOSITORY');

/**
 * Filtros do feed de registros da portaria (ADR 0015).
 */
export interface ListAccessRecordsRepositoryFilters {
  /** Filtra por tipo de registro (`ENTRY`/`EXIT`/`DENIAL`). */
  kind?: AccessRecordKind;
  /** Busca por placa (parcial, normalizada). */
  plate?: string;
  /** Início do período (inclusive) sobre `occurred_at`. */
  dateFrom?: Date;
  /** Fim do período (inclusive) sobre `occurred_at`. */
  dateTo?: Date;
  /** Portaria do device. */
  entranceId?: string;
  /** Porteiro que registrou. */
  doormanId?: string;
  /** Quantidade de registros por página. */
  limit: number;
  /** Offset da página. */
  offset: number;
}

/**
 * Contrato do feed de registros da portaria.
 *
 * A união dos dois ledgers (`vehicle_movement` + `entry_denial`) é feita **na
 * leitura** (ADR 0015): nenhuma tabela nova é criada e cada ledger continua
 * sendo a fonte única do seu fato. Escopado por `company_id`.
 */
export interface AccessRecordRepository {
  /**
   * Lista os registros da empresa, mais recente primeiro.
   *
   * @param companyId Empresa da sessão.
   * @param filters Filtros e paginação.
   * @returns Dados da página e total sem paginação.
   */
  list(
    companyId: string,
    filters: ListAccessRecordsRepositoryFilters,
  ): Promise<{ data: AccessRecordEntity[]; count: number }>;
}
