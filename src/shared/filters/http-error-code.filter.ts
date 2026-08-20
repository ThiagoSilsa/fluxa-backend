// NestJS
import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
} from '@nestjs/common';

// Types
import type { Response } from 'express';

/**
 * Filtro global de exceções que adiciona um `code` estável ao corpo de erro
 * (ADR 0007 §7).
 *
 * Mantém o formato padrão do NestJS (`{ statusCode, message, error? }`) e
 * acrescenta `code`, derivado da mensagem (normalização NFD → `_` →
 * `UPPERCASE`; prefixo `ERROR_` quando começa com dígito). Isso permite ao
 * client traduzir erros de importação do padrão `Linha {N}: ...` →
 * `LINHA_{N}_{MENSAGEM}` — o front já espera `payload.code`
 * (`ApiErrorPayload`).
 */
@Catch()
export class HttpErrorCodeFilter implements ExceptionFilter {
  /**
   * Trata a exceção, escrevendo o corpo `{ statusCode, message, error?, code? }`.
   *
   * @param exception Exceção capturada.
   * @param host Argumentos do contexto HTTP.
   */
  public catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    let status = 500;
    let message: string | string[] = 'Internal server error';
    let error: string | undefined;

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const body = exception.getResponse();

      if (typeof body === 'string') {
        message = body;
      } else if (body && typeof body === 'object') {
        const record = body as Record<string, unknown>;
        const rawMessage = record.message;
        if (typeof rawMessage === 'string') {
          message = rawMessage;
        } else if (Array.isArray(rawMessage)) {
          message = rawMessage.filter(
            (item): item is string => typeof item === 'string',
          );
        }
        if (typeof record.error === 'string') {
          error = record.error;
        }
      }
    } else if (exception instanceof Error) {
      message = exception.message || message;
    }

    const code =
      typeof message === 'string'
        ? this.deriveCodeFromMessage(message)
        : undefined;

    const payload: Record<string, unknown> = { statusCode: status, message };
    if (error !== undefined) payload.error = error;
    if (code !== undefined) payload.code = code;

    response.status(status).json(payload);
  }

  /**
   * Deriva um código estável e normalizado a partir de uma mensagem de erro.
   *
   * @param message Mensagem de erro (ex.: `Linha 3: name inválido.`).
   * @returns Código normalizado ou `undefined` quando a mensagem não gera código.
   */
  private deriveCodeFromMessage(message: string): string | undefined {
    const normalized = message
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-zA-Z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '')
      .replace(/_+/g, '_')
      .toUpperCase();

    if (normalized.length === 0) return undefined;
    if (/^\d/.test(normalized)) return `ERROR_${normalized}`;
    return normalized;
  }
}
