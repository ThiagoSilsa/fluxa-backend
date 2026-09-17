// NestJS
import { BadRequestException } from '@nestjs/common';

// Constants
import type {
  ImportRowErrorCode,
  ImportRowErrorParams,
} from '../constants/import-row-error.constant';

/**
 * Falha de uma linha (ou do job) da importação por planilha, com o **código** e
 * os **parâmetros** que o cliente traduz (ADR 0016 §6).
 *
 * Estende `BadRequestException` de propósito (AGENTS.md §2): continua sendo uma
 * exceção HTTP nativa do Nest, mas quem a captura é o **worker** — o erro nunca
 * chega ao cliente como corpo de erro, ele vira `error_code`/`error_params` no
 * job consultado por polling. A mensagem em português segue junto como texto de
 * desenvolvimento e log.
 */
export class ImportRowError extends BadRequestException {
  /** Código do erro (contrato de tradução). */
  public readonly code: ImportRowErrorCode;

  /** Parâmetros que o texto do erro precisa. */
  public readonly params: ImportRowErrorParams;

  /**
   * @param code Código do erro de importação.
   * @param params Parâmetros do texto (a linha entra sempre).
   * @param message Mensagem em português (texto de desenvolvimento e log).
   */
  constructor(
    code: ImportRowErrorCode,
    params: ImportRowErrorParams,
    message: string,
  ) {
    super({ code, params, message });
    this.code = code;
    this.params = params;
    this.name = 'ImportRowError';
  }
}
