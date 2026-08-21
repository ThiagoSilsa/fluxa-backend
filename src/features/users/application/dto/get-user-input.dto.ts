/**
 * Entrada do use case de detalhe de usuário (já validado pelo controller).
 */
export class GetUserInputDto {
  constructor(
    /** Id da pessoa. */
    readonly id: string,
  ) {}
}
