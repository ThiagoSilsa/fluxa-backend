// NestJS
import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
} from '@nestjs/common';

// Shared
import { deriveErrorCode } from '../utils/error-code.util';

// Types
import type { Response } from 'express';

/**
 * Filtro global de exceções que adiciona um `code` estável ao corpo de erro
 * (ADR 0007 §7; ampliado pelo ADR 0016).
 *
 * Mantém o formato padrão do NestJS (`{ statusCode, message, error? }`) e
 * acrescenta `code`, derivado da mensagem pelo util compartilhado
 * (`deriveErrorCode`) — o mesmo que as respostas de resultado usam. O `code` é
 * o contrato que o cliente traduz; a mensagem é texto de desenvolvimento e log.
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
      typeof message === 'string' ? deriveErrorCode(message) : undefined;

    const payload: Record<string, unknown> = { statusCode: status, message };
    if (error !== undefined) payload.error = error;
    if (code !== undefined) payload.code = code;

    response.status(status).json(payload);
  }
}
