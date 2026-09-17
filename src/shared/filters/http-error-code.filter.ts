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
 *
 * Um corpo de exceção que já traga `code` ou `details` (a validação de DTO, ADR
 * 0016 §4) é preservado: o código explícito vence a derivação — sem isso o erro
 * de validação ficaria sem código, porque ali a mensagem é uma lista.
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
    let code: string | undefined;
    let details: unknown;

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
        if (typeof record.code === 'string') {
          code = record.code;
        }
        if (record.details !== undefined) {
          details = record.details;
        }
      }
    } else if (exception instanceof Error) {
      message = exception.message || message;
    }

    if (code === undefined && typeof message === 'string') {
      code = deriveErrorCode(message);
    }

    const payload: Record<string, unknown> = { statusCode: status, message };
    if (error !== undefined) payload.error = error;
    if (code !== undefined) payload.code = code;
    if (details !== undefined) payload.details = details;

    response.status(status).json(payload);
  }
}
