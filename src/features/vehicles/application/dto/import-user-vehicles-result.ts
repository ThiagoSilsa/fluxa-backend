/**
 * Resultado do upload de importação de vínculo usuário-veículo (ADR 0007 §6).
 */
export interface ImportUserVehiclesResult {
  /** Id do job criado (para o polling da UI). */
  jobId: string;
  /** Status inicial do job. */
  status: 'PENDING';
}
