/**
 * Opção de cargo da empresa — resposta enxuta de seleção de baixo privilégio
 * (ADR 0011). Não expõe descrição, flag de administração nem permissões.
 */
export interface RoleOptionResponse {
  /** Id do cargo. */
  id: string;
  /** Nome do cargo. */
  name: string;
}

/** Envelope paginado de opções de cargo (formato padrão do AGENTS.md §3). */
export interface ListRoleOptionsResponse {
  /** Quantidade de registros retornados. */
  limit: number;
  /** Offset da página. */
  offset: number;
  /** Registros da página. */
  data: RoleOptionResponse[];
  /** Total de registros (sem paginação). */
  count: number;
}
