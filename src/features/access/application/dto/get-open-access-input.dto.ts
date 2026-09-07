/**
 * Entrada do use case de consulta de acesso aberto (conferência na saída).
 */
export class GetOpenAccessInputDto {
  constructor(
    /** Placa (normalizada na validação). */
    readonly plate: string,
  ) {}
}
