// Types
import type {
  ImportJobStatus,
  ImportJobType,
} from '../../domain/constants/import-job.constant';

/**
 * Job de importação no formato de resposta da API (ADR 0007 §6).
 */
export interface ImportJobResponse {
  /** Id do job. */
  id: string;
  /** Tipo de importação. */
  type: ImportJobType;
  /** Status do job. */
  status: ImportJobStatus;
  /** Total de linhas da planilha. */
  totalRows: number;
  /** Linhas processadas. */
  processedRows: number;
  /** Linhas inseridas com sucesso. */
  successCount: number;
  /** Linhas com erro. */
  errorCount: number;
  /** Mensagem de erro (fail-fast). */
  errorMessage: string | null;
  /** Nome do arquivo enviado. */
  fileName: string | null;
  /** Data de criação (ISO). */
  createdAt: string;
  /** Início do processamento (ISO) ou `null`. */
  startedAt: string | null;
  /** Fim do processamento (ISO) ou `null`. */
  completedAt: string | null;
}

/**
 * Resposta paginada de jobs (formato padrão AGENTS.md §3).
 */
export interface ListImportJobsResponse {
  /** Quantidade de registros da página. */
  limit: number;
  /** Offset da página. */
  offset: number;
  /** Total de registros sem paginação. */
  count: number;
  /** Jobs da página. */
  data: ImportJobResponse[];
}
