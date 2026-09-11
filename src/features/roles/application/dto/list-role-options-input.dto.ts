/**
 * Entrada do use case de opções de cargo (já validada pelo controller).
 *
 * Lista enxuta para seletores (ex.: cargo do Colaborador no aceite de
 * solicitação) — sem busca por nome nem filtro de status na entrada: os
 * cargos oferecidos são sempre os **ativos** da empresa da sessão.
 */
export class ListRoleOptionsInputDto {
  constructor(
    /** Quantidade de registros por página. */
    readonly limit: number = 20,
    /** Offset da página. */
    readonly offset: number = 0,
  ) {}
}
