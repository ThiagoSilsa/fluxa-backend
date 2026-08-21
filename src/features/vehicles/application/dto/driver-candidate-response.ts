/**
 * Candidato a motorista — pessoa com vínculo `user_company` ativo na empresa
 * da sessão (pode ser vinculada a um veículo via `user_vehicle`).
 */
export interface DriverCandidateResponse {
  /** Id da pessoa (`user`). */
  id: string;
  /** Nome da pessoa. */
  name: string;
}

/** Envelope paginado de candidatos a motorista. */
export interface ListDriverCandidatesResponse {
  limit: number;
  offset: number;
  data: DriverCandidateResponse[];
  count: number;
}
