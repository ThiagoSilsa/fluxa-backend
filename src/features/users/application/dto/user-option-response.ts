/**
 * Opção de usuário ativo da empresa — resposta enxuta de seleção para
 * solicitantes (ADR 0011). Não expõe campos sensíveis/administrativos.
 */
export interface UserOptionResponse {
  /** Id da pessoa (`user`). */
  id: string;
  /** Nome da pessoa. */
  name: string;
  /**
   * E-mail (identidade global) — ajuda a desambiguar homônimos; `null` para
   * Visitante sem e-mail (ADR 0013).
   */
  email: string | null;
}

/** Envelope paginado de opções de usuário. */
export interface ListUserOptionsResponse {
  limit: number;
  offset: number;
  data: UserOptionResponse[];
  count: number;
}
