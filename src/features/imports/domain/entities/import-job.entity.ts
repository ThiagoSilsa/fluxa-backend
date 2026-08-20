// Constants
import {
  ImportJobStatus,
  ImportJobType,
} from '../constants/import-job.constant';

/**
 * Entidade de domínio de um job de importação — espelha a tabela `import_job`
 * (migration `0005` + `0011`; ADR 0007 §3).
 *
 * Guarda tudo o que a UI precisa para mostrar progresso e histórico, escopado
 * pela empresa (`companyId`).
 */
export class ImportJobEntity {
  /** Id do job. */
  id!: string;
  /** Empresa dona do job (multi-tenant). */
  companyId!: string;
  /** Id do usuário que criou o job (nullable — a tabela permite). */
  createdByUserId!: string | null;
  /** Tipo de importação. */
  type!: ImportJobType;
  /** Nome do arquivo enviado (para o histórico). */
  fileName!: string | null;
  /** Total de linhas da planilha. */
  totalRows!: number;
  /** Linhas processadas até agora. */
  processedRows!: number;
  /** Linhas inseridas com sucesso. */
  successCount!: number;
  /** Linhas com erro (fail-fast: `1` quando o job falha). */
  errorCount!: number;
  /** Status do job. */
  status!: ImportJobStatus;
  /** Mensagem de erro (fail-fast: `Linha N: ...`). */
  errorMessage!: string | null;
  /** Início do processamento. */
  startedAt!: Date | null;
  /** Fim do processamento (sucesso ou falha). */
  completedAt!: Date | null;
  /** Data de criação. */
  createdAt!: Date;
}
