/**
 * Entrada dos use cases que operam sobre um departamento específico
 * (detalhar, desativar) — carrega apenas o id.
 */
export class GetDepartmentInputDto {
  constructor(
    /** Id do departamento. */
    readonly id: string,
  ) {}
}
