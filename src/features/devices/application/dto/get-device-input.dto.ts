/**
 * Entrada dos use cases que operam sobre um dispositivo específico (detalhar,
 * excluir, rotacionar token) — carrega apenas o id.
 */
export class GetDeviceInputDto {
  constructor(
    /** Id do dispositivo. */
    readonly id: string,
  ) {}
}
