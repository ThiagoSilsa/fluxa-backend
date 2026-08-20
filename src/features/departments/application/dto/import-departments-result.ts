/**
 * Resultado do upload de importação de departamentos (ADR 0007 §6).
 */
export interface ImportDepartmentsResult {
  /** Id do job criado (para o polling da UI). */
  jobId: string;
  /** Status inicial do job. */
  status: 'PENDING';
}
