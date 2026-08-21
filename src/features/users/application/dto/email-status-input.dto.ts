/**
 * Entrada do use case de consulta de existência de e-mail (já validado).
 */
export class EmailStatusInputDto {
  constructor(
    /** E-mail a consultar (normalizado no use case). */
    readonly email: string,
  ) {}
}
