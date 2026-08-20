// Types
import type {
  ImportJobStatus,
  ImportJobType,
} from '../constants/import-job.constant';
import type { ImportJobEntity } from '../entities/import-job.entity';

/**
 * Symbol token de injeção do `ImportJobRepository`.
 */
export const IMPORT_JOB_REPOSITORY = Symbol('IMPORT_JOB_REPOSITORY');

/**
 * Dados para criação de um job de importação.
 */
export interface CreateImportJobInput {
  /** Empresa dona do job. */
  companyId: string;
  /** Id do usuário que criou o job (nullable). */
  createdByUserId: string | null;
  /** Tipo de importação. */
  type: ImportJobType;
  /** Nome do arquivo enviado. */
  fileName: string | null;
  /** Total de linhas da planilha. */
  totalRows: number;
}

/**
 * Dados opcionais de atualização de um job (campos parciais).
 */
export interface UpdateImportJobData {
  totalRows?: number;
  processedRows?: number;
  successCount?: number;
  errorCount?: number;
  errorMessage?: string;
  startedAt?: Date;
  completedAt?: Date;
}

/**
 * Entrada da listagem paginada de jobs de uma empresa.
 */
export interface FindImportJobsRepositoryInput {
  /** Empresa da sessão. */
  companyId: string;
  /** Filtro opcional por tipo de importação. */
  type?: ImportJobType;
  /** Quantidade de registros por página. */
  limit: number;
  /** Offset da página. */
  offset: number;
}

/**
 * Contrato do repositório de jobs de importação.
 *
 * Todas as operações são escopadas por `companyId` (sufixo `AndCompanyId`) —
 * o `companyId` vem da sessão e garante que jobs nunca vazem entre empresas.
 */
export interface ImportJobRepository {
  /**
   * Cria um job de importação (status inicial `PENDING`).
   *
   * @param input Dados de criação (inclui `companyId` e `createdByUserId`).
   * @returns O job criado.
   */
  create(input: CreateImportJobInput): Promise<ImportJobEntity>;

  /**
   * Busca um job pelo id dentro da empresa.
   *
   * @param id Id do job.
   * @param companyId Empresa da sessão.
   * @returns O job da empresa ou `null` se não existir/não pertencer.
   */
  findByIdAndCompanyId(
    id: string,
    companyId: string,
  ): Promise<ImportJobEntity | null>;

  /**
   * Lista jobs da empresa com paginação e filtro opcional por tipo, do mais
   * recente para o mais antigo.
   *
   * @param input Filtros, paginação e empresa.
   * @returns Dados da página e total sem paginação.
   */
  findByCompanyIdPaginated(
    input: FindImportJobsRepositoryInput,
  ): Promise<{ data: ImportJobEntity[]; count: number }>;

  /**
   * Atualiza o status (e dados opcionais) de um job.
   *
   * @param id Id do job.
   * @param status Novo status.
   * @param data Dados adicionais opcionais.
   */
  updateStatus(
    id: string,
    status: ImportJobStatus,
    data?: UpdateImportJobData,
  ): Promise<void>;
}
