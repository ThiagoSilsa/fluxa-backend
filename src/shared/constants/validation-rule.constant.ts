/**
 * Códigos de regra de validação — o identificador de **superfície** que o
 * cliente traduz (ADR 0016 §4).
 *
 * São poucos e estáveis de propósito: a regra diz o que o usuário precisa
 * corrigir ("obrigatório", "formato inválido", "máximo de 100 caracteres"), e
 * não qual validador do `class-validator` falhou (`maxLength`, `isString`). Os
 * números que o texto precisa viajam em `params` (`max`, `min`, `values`).
 *
 * O cliente mantém o texto de cada código (`errors.validation.<CODIGO>`).
 */
export enum ValidationRule {
  /** Campo obrigatório (ausente ou vazio). */
  REQUIRED = 'REQUIRED',
  /** Passa do tamanho máximo (`params.max`). */
  MAX_LENGTH = 'MAX_LENGTH',
  /** Não alcança o tamanho mínimo (`params.min`). */
  MIN_LENGTH = 'MIN_LENGTH',
  /** Não é um e-mail válido. */
  INVALID_EMAIL = 'INVALID_EMAIL',
  /** Não casa com o formato esperado (placa, UUID, telefone). */
  INVALID_FORMAT = 'INVALID_FORMAT',
  /** Menor que o mínimo aceito (`params.min`). */
  MIN_VALUE = 'MIN_VALUE',
  /** Maior que o máximo aceito (`params.max`). */
  MAX_VALUE = 'MAX_VALUE',
  /** Tipo errado (texto, número, booleano ou objeto). */
  INVALID_TYPE = 'INVALID_TYPE',
  /** Valor fora do conjunto aceito (`params.values`) — ou sem regra própria. */
  INVALID_VALUE = 'INVALID_VALUE',
  /** Data inválida. */
  INVALID_DATE = 'INVALID_DATE',
  /**
   * Coluna que a planilha não aceita (o campo é o nome da coluna, `params`
   * vazio).
   *
   * Não vem do `class-validator`: é **declarada** pela validação de estrutura da
   * importação por planilha, que reaproveita a mesma superfície de detalhes
   * (ADR 0016 §4).
   */
  UNKNOWN_COLUMN = 'UNKNOWN_COLUMN',
}

/**
 * Código de topo do erro de validação. O cliente guarda `errors.validation`
 * como reserva quando a resposta não trouxer `details`.
 */
export const VALIDATION_ERROR_CODE = 'VALIDATION_ERROR';

/**
 * Nome da constraint do `class-validator` → código de regra.
 *
 * Constraint fora deste mapa cai em `INVALID_VALUE`: o cliente sempre recebe um
 * código, nunca a ausência dele.
 */
export const CONSTRAINT_RULE_MAP: Readonly<Record<string, ValidationRule>> = {
  isNotEmpty: ValidationRule.REQUIRED,
  isDefined: ValidationRule.REQUIRED,
  maxLength: ValidationRule.MAX_LENGTH,
  minLength: ValidationRule.MIN_LENGTH,
  isEmail: ValidationRule.INVALID_EMAIL,
  matches: ValidationRule.INVALID_FORMAT,
  min: ValidationRule.MIN_VALUE,
  max: ValidationRule.MAX_VALUE,
  isString: ValidationRule.INVALID_TYPE,
  isInt: ValidationRule.INVALID_TYPE,
  isBoolean: ValidationRule.INVALID_TYPE,
  isObject: ValidationRule.INVALID_TYPE,
  isEnum: ValidationRule.INVALID_VALUE,
  isIn: ValidationRule.INVALID_VALUE,
  isDateString: ValidationRule.INVALID_DATE,
};
