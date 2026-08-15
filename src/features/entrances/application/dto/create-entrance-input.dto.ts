/**
 * Entrada do use case de criação de portaria (já validada pelo controller).
 */
export class CreateEntranceInputDto {
  constructor(
    /** Nome da portaria (ex.: `Portaria Principal`). */
    readonly name: string,
  ) {}
}
