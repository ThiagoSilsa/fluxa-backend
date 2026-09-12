/**
 * Entrada do use case de contexto + veredito da entrada (já validada pelo
 * controller).
 */
export class GetAccessContextInputDto {
  constructor(
    /** Placa (normalizada na validação). */
    readonly plate: string,
    /** Busca de motorista (nome/telefone/documento) — habilita as sugestões. */
    readonly search?: string,
    /** Setor para o qual a ocupação é avaliada (default: padrão do veículo). */
    readonly departmentId?: string,
    /**
     * Motorista escolhido na ficha — quando informado, o veredito reflete
     * **esse** motorista (`ALLOW` vs `ALLOW_WITH_REQUEST`); quando ausente, o
     * veredito reflete o melhor cenário com os motoristas vinculados.
     */
    readonly driverUserId?: string,
  ) {}
}
