// class-validator
import { getMetadataStorage } from 'class-validator';
import type { ValidationError } from 'class-validator';

// Constants
import {
  CONSTRAINT_RULE_MAP,
  ValidationRule,
} from '../constants/validation-rule.constant';

/** Valores que um texto de regra pode precisar (`max`, `min`, `values`). */
type ValidationParam = number | string | string[];

/**
 * Uma violação de validação no formato que o cliente consome (ADR 0016 §4).
 */
export interface ValidationDetail {
  /** Caminho pontuado da propriedade (`payload.driver.email`). */
  field: string;
  /** Código da regra violada. */
  code: ValidationRule;
  /** O que o texto da regra precisa para ficar completo (ex.: `{ max: 100 }`). */
  params: Record<string, ValidationParam>;
}

/**
 * Achata os erros do `class-validator` nas violações que o cliente traduz.
 *
 * Cada violação vira `{ field, code, params }`: o campo no caminho pontuado
 * (DTO aninhado entra com o caminho completo), o código da regra **de
 * superfície** e os números/valores que o texto precisa. As mensagens originais
 * do `class-validator` ficam de fora: são texto de desenvolvimento (o cliente
 * monta a frase a partir do código).
 *
 * Um campo aparece **uma vez**, com a regra que explica o problema: obrigatório
 * vence tudo, e tipo errado vence as falhas derivadas dele (um número no lugar
 * de um texto não é "longo demais", é do tipo errado).
 *
 * Função pura — a única dependência é o armazenamento de metadados do
 * `class-validator`, de onde saem os argumentos das constraints (`@MaxLength(100)`
 * → `{ max: 100 }`), que o erro de validação não carrega.
 *
 * @param errors Erros devolvidos pelo `class-validator`.
 * @returns Violações na ordem em que o `class-validator` as encontrou.
 */
export function toValidationDetails(
  errors: ValidationError[],
): ValidationDetail[] {
  const byField = new Map<string, ValidationDetail>();
  collectDetails(errors, '', byField);

  return [...byField.values()];
}

/**
 * Regra que explica o problema quando mais de uma falha no mesmo campo — quanto
 * menor, mais específica.
 */
const RULE_SPECIFICITY: Readonly<Record<ValidationRule, number>> = {
  [ValidationRule.REQUIRED]: 0,
  [ValidationRule.INVALID_TYPE]: 1,
  [ValidationRule.INVALID_VALUE]: 2,
  [ValidationRule.INVALID_EMAIL]: 2,
  [ValidationRule.INVALID_DATE]: 2,
  [ValidationRule.INVALID_FORMAT]: 2,
  [ValidationRule.UNKNOWN_COLUMN]: 2,
  [ValidationRule.MIN_LENGTH]: 3,
  [ValidationRule.MAX_LENGTH]: 3,
  [ValidationRule.MIN_VALUE]: 3,
  [ValidationRule.MAX_VALUE]: 3,
};

/**
 * Percorre os erros (e os filhos de DTO aninhado) guardando uma violação por
 * campo.
 *
 * @param errors Erros do nível atual.
 * @param parentPath Caminho da propriedade pai (vazio no topo).
 * @param byField Violações por campo, na ordem em que apareceram.
 */
function collectDetails(
  errors: ValidationError[],
  parentPath: string,
  byField: Map<string, ValidationDetail>,
): void {
  for (const error of errors) {
    const field = parentPath
      ? `${parentPath}.${error.property}`
      : error.property;
    const constraints = error.constraints ?? {};
    const args = readConstraintArgs(error);

    for (const constraintName of Object.keys(constraints)) {
      const candidate: ValidationDetail = {
        field,
        code:
          CONSTRAINT_RULE_MAP[constraintName] ?? ValidationRule.INVALID_VALUE,
        params: readParams(constraintName, args[constraintName]),
      };

      const current = byField.get(field);
      if (
        !current ||
        RULE_SPECIFICITY[candidate.code] < RULE_SPECIFICITY[current.code]
      ) {
        byField.set(field, candidate);
      }
    }

    if (error.children?.length) {
      collectDetails(error.children, field, byField);
    }
  }
}

/**
 * Lê os argumentos declarados nas constraints da propriedade.
 *
 * O erro de validação traz só o nome da constraint e a mensagem (em inglês),
 * então os números/valores saem do armazenamento de metadados do
 * `class-validator`: `@MaxLength(100)` → `{ maxLength: [100] }`.
 *
 * @param error Erro de uma propriedade.
 * @returns Argumentos por nome de constraint.
 */
function readConstraintArgs(
  error: ValidationError,
): Record<string, unknown[] | undefined> {
  const target: unknown = error.target;
  if (!target || typeof target !== 'object') {
    return {};
  }

  const constructor = target.constructor;
  if (typeof constructor !== 'function') {
    return {};
  }

  const metadata = getMetadataStorage().getTargetValidationMetadatas(
    constructor,
    '',
    false,
    false,
  );

  const args: Record<string, unknown[] | undefined> = {};
  for (const meta of metadata) {
    if (meta.propertyName !== error.property || !meta.name) {
      continue;
    }
    args[meta.name] = meta.constraints;
  }

  return args;
}

/**
 * Extrai os parâmetros que o texto da regra precisa.
 *
 * @param constraintName Nome da constraint que falhou.
 * @param constraintArgs Argumentos declarados na constraint.
 * @returns Parâmetros (`{ max }`, `{ min }`, `{ values }`) ou objeto vazio.
 */
function readParams(
  constraintName: string,
  constraintArgs: unknown[] | undefined,
): Record<string, ValidationParam> {
  const first = constraintArgs?.[0];
  const rule = CONSTRAINT_RULE_MAP[constraintName];

  if (rule === ValidationRule.INVALID_VALUE) {
    const values = toValues(first);
    return values.length ? { values } : {};
  }

  if (typeof first !== 'number') {
    return {};
  }

  switch (rule) {
    case ValidationRule.MAX_LENGTH:
    case ValidationRule.MAX_VALUE:
      return { max: first };
    case ValidationRule.MIN_LENGTH:
    case ValidationRule.MIN_VALUE:
      return { min: first };
    default:
      return {};
  }
}

/**
 * Converte o conjunto aceito de uma constraint (`@IsEnum`, `@IsIn`) em lista.
 *
 * @param value Array ou enum informado na constraint.
 * @returns Valores aceitos em texto.
 */
function toValues(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map((item) => String(item));
  }

  if (value && typeof value === 'object') {
    return Object.values(value).map((item) => String(item));
  }

  return [];
}
