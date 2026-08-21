/**
 * Entrada dos use cases que operam sobre um cargo específico (detalhar,
 * desativar) — carrega apenas o id.
 */
export class GetRoleInputDto {
  constructor(
    /** Id do cargo. */
    readonly id: string,
  ) {}
}
