/**
 * Resultado do upload de importação de veículos (ADR 0007 §6).
 */
export interface ImportVehiclesResult {
  /** Id do job criado (para o polling da UI). */
  jobId: string;
  /** Status inicial do job. */
  status: 'PENDING';
}
