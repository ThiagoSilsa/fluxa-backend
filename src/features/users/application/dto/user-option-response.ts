/**
 * Opção de usuário ativo da empresa — resposta enxuta de seleção para
 * solicitantes (ADR 0011). Não expõe campos sensíveis/administrativos.
 */
export interface UserOptionResponse {
  /** Id da pessoa (`user`). */
  id: string;
  /** Nome da pessoa. */
  name: string;
  /** E-mail (identidade global) — ajuda a desambiguar homônimos. */
  email: string;
}

/** Envelope paginado de opções de usuário. */
export interface ListUserOptionsResponse {
  limit: number;
  offset: number;
  data: UserOptionResponse[];
  count: number;
}
