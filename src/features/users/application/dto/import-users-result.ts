/**
 * Resultado do upload de importação de usuários (ADR 0007 §6).
 */
export interface ImportUsersResult {
  /** Id do job criado (para o polling da UI). */
  jobId: string;
  /** Status inicial do job. */
  status: 'PENDING';
}
