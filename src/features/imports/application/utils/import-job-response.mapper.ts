// Types
import type { ImportJobEntity } from '../../domain/entities/import-job.entity';
import type { ImportJobResponse } from '../dto/import-job-response';

/**
 * Converte a entidade de domínio de um job na resposta da API.
 *
 * Datas viram ISO strings; campos nulos são preservados como `null`.
 *
 * @param job Entidade de domínio do job.
 * @returns Job no formato de resposta.
 */
export function toImportJobResponse(job: ImportJobEntity): ImportJobResponse {
  return {
    id: job.id,
    type: job.type,
    status: job.status,
    totalRows: job.totalRows,
    processedRows: job.processedRows,
    successCount: job.successCount,
    errorCount: job.errorCount,
    errorMessage: job.errorMessage,
    fileName: job.fileName,
    createdAt: job.createdAt.toISOString(),
    startedAt: job.startedAt ? job.startedAt.toISOString() : null,
    completedAt: job.completedAt ? job.completedAt.toISOString() : null,
  };
}
