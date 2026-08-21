/**
 * Entrada do use case de criação de solicitação de bloqueio (porteiro).
 */
export class CreateBlockRequestInputDto {
  constructor(
    /** Placa (normalizada na validação). */
    readonly plate: string,
    /** Motivo (obrigatório). */
    readonly reason: string,
  ) {}
}
