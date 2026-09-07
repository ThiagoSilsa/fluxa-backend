/**
 * Entrada do use case de opções de usuário (já validada pelo controller).
 *
 * Busca por nome ou e-mail — mesmo comportamento do seletor da tela de
 * solicitações (ADR 0011 §4).
 */
export class ListUserOptionsInputDto {
  constructor(
    /** Busca parcial (case-insensitive) por nome ou e-mail. */
    readonly search?: string,
    /** Quantidade de registros por página. */
    readonly limit: number = 20,
    /** Offset da página. */
    readonly offset: number = 0,
  ) {}
}
