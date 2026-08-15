/**
 * Entrada dos use cases que operam sobre uma portaria específica (detalhar,
 * desativar) — carrega apenas o id.
 */
export class GetEntranceInputDto {
  constructor(
    /** Id da portaria. */
    readonly id: string,
  ) {}
}
