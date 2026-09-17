/**
 * Códigos de erro de importação por planilha — o contrato que o cliente traduz
 * (ADR 0016 §6).
 *
 * Diferente das outras famílias, aqui o código é **declarado**: o erro da linha
 * é persistido no job (`error_code` + `error_params`), não passa pelo filtro de
 * exceções e por isso não teria texto de onde derivar código. Os parâmetros
 * acompanham o código porque a frase só fica completa com eles (a linha, o nome
 * ou a placa citados, os limites da regra).
 *
 * **Lista estável e legível por máquina**: o gerador do catálogo do cliente lê
 * exatamente estes literais (além das mensagens do filtro) para montar as chaves
 * de tradução. Não renomeie um código existente sem ressincronizar o catálogo —
 * o valor faz parte do contrato.
 */
export const IMPORT_ROW_ERROR_CODES = [
  // Falhas do job (não de uma linha específica)
  'SPREADSHEET_READ_ERROR',
  'SPREADSHEET_EMPTY',
  // Falhas de linha (todo código de linha recebe `line` nos parâmetros)
  'NAME_LENGTH',
  'DEPARTMENT_DUPLICATE',
  'DEPARTMENT_NOT_FOUND',
  'PARKING_SPACE_INVALID',
  'EMAIL_REQUIRED',
  'EMAIL_ALREADY_LINKED',
  'USER_TYPE_INVALID',
  'ROLE_NOT_FOUND',
  'ROLE_INACTIVE',
  'DOCUMENT_ALREADY_REGISTERED',
  'PLATE_INVALID',
  'PLATE_ALREADY_REGISTERED',
  'VEHICLE_TYPE_NOT_FOUND',
  'VEHICLE_TYPE_INACTIVE',
  'VEHICLE_NOT_FOUND',
  'FREE_PASS_INVALID',
  'USER_NOT_FOUND_OR_UNLINKED',
  'LINK_ALREADY_EXISTS',
  'IS_PRIMARY_INVALID',
  'PRIMARY_OWNER_EXISTS',
  'CAN_DRIVE_INVALID',
] as const;

/** Código de erro de importação (um dos literais da lista acima). */
export type ImportRowErrorCode = (typeof IMPORT_ROW_ERROR_CODES)[number];

/** Parâmetros que o texto do erro precisa (a linha e o que a regra cita). */
export type ImportRowErrorParams = Record<string, string | number>;
