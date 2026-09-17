// NestJS
import { BadRequestException, HttpStatus } from '@nestjs/common';

// class-validator
import type { ValidationError } from 'class-validator';

// Constants
import { VALIDATION_ERROR_CODE } from '../constants/validation-rule.constant';

// Utils
import { toValidationDetails } from '../utils/validation-detail.util';
import type { ValidationDetail } from '../utils/validation-detail.util';

/**
 * Corpo do erro de validação de DTO (ADR 0016 §4).
 *
 * Aditivo ao corpo padrão do filtro: `code` de topo (`VALIDATION_ERROR`) e
 * `details` com o que o cliente precisa para dizer **qual campo** falhou e **o
 * que** ele violou. `message` continua com as frases originais do
 * `class-validator` — texto de desenvolvimento, nunca exibido.
 */
export interface ValidationErrorBody {
  /** Sempre 400. */
  statusCode: number;
  /** Código de topo (`VALIDATION_ERROR`). */
  code: string;
  /** Frases originais do `class-validator` (texto de desenvolvimento). */
  message: string[];
  /** Violações: campo, regra e parâmetros. */
  details: ValidationDetail[];
}

/**
 * Fábrica de exceção do `ValidationPipe` global (registrada no `AppModule`).
 *
 * Troca o 400 padrão do NestJS (lista de frases em inglês, sem campo e sem
 * código) pelo corpo que o cliente traduz: `details[{ field, code, params }]`.
 * Nenhum DTO declara mensagem própria — o catálogo de regras mora aqui
 * (`ValidationRule`), não espalhado pelas features.
 *
 * @param errors Erros devolvidos pelo `class-validator`.
 * @returns Exceção 400 com campo, regra e parâmetros.
 */
export function validationExceptionFactory(
  errors: ValidationError[],
): BadRequestException {
  const body: ValidationErrorBody = {
    statusCode: HttpStatus.BAD_REQUEST,
    code: VALIDATION_ERROR_CODE,
    message: toValidationMessages(errors),
    details: toValidationDetails(errors),
  };

  return new BadRequestException(body);
}

/**
 * Exceção 400 de uma validação **declarada** pela aplicação (não pelo
 * `class-validator`) na mesma superfície do cliente.
 *
 * Usada por quem valida estrutura que não passa por DTO — hoje, as colunas da
 * planilha de importação. A mensagem continua sendo texto de desenvolvimento
 * (pode ser interpolada com o dado da requisição): o cliente lê `details`.
 *
 * @param message Mensagem em texto de desenvolvimento (log).
 * @param details Violações declaradas: campo, regra e parâmetros.
 * @returns Exceção 400 com o corpo de validação.
 */
export function declaredValidationException(
  message: string,
  details: ValidationDetail[],
): BadRequestException {
  const body: ValidationErrorBody = {
    statusCode: HttpStatus.BAD_REQUEST,
    code: VALIDATION_ERROR_CODE,
    message: [message],
    details,
  };

  return new BadRequestException(body);
}

/**
 * Achata as mensagens originais do `class-validator`, incluindo as de DTO
 * aninhado.
 *
 * @param errors Erros devolvidos pelo `class-validator`.
 * @returns Mensagens em texto de desenvolvimento.
 */
function toValidationMessages(errors: ValidationError[]): string[] {
  const messages: string[] = [];

  for (const error of errors) {
    messages.push(...Object.values(error.constraints ?? {}));

    if (error.children?.length) {
      messages.push(...toValidationMessages(error.children));
    }
  }

  return messages;
}
