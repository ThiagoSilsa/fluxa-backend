// Types
import type { ImportJobType } from '../../domain/constants/import-job.constant';

/**
 * Entrada do use case de listagem de jobs (já validada pelo controller).
 */
export class ListImportJobsDto {
  constructor(
    /** Filtro opcional por tipo de importação. */
    readonly type?: ImportJobType,
    /** Quantidade de registros por página (default 20). */
    readonly limit: number = 20,
    /** Offset da página (default 0). */
    readonly offset: number = 0,
  ) {}
}
