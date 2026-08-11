/**
 * Função de validação/normalização de variáveis de ambiente usada pelo
 * ConfigModule (`validate`). Aplica defaults de desenvolvimento e lança erro
 * claro quando um valor presente é inválido.
 *
 * @param config Objeto de configuração cru fornecido pelo @nestjs/config.
 * @returns Objeto de configuração validado/normalizado.
 * @throws {Error} Quando uma variável presente não pode ser convertida.
 */
export function validateEnvironment(
  config: Record<string, unknown>,
): Record<string, unknown> {
  const env: Record<string, unknown> = { ...config };

  env.PORT = parseIntValue(env.PORT, 3000, 'PORT');
  env.DB_HOST = env.DB_HOST ?? 'localhost';
  env.DB_PORT = parseIntValue(env.DB_PORT, 5432, 'DB_PORT');
  env.DB_USERNAME = env.DB_USERNAME ?? 'postgres';
  env.DB_PASSWORD = env.DB_PASSWORD ?? 'postgres';
  env.DB_NAME = env.DB_NAME ?? 'postgres';
  env.DB_SYNCHRONIZE = parseBooleanValue(
    env.DB_SYNCHRONIZE,
    false,
    'DB_SYNCHRONIZE',
  );
  env.DB_LOGGING = parseBooleanValue(env.DB_LOGGING, false, 'DB_LOGGING');
  env.REDIS_HOST = env.REDIS_HOST ?? 'localhost';
  env.REDIS_PORT = parseIntValue(env.REDIS_PORT, 6379, 'REDIS_PORT');
  env.ADMIN_DEFAULT_EMAIL = env.ADMIN_DEFAULT_EMAIL ?? 'admin@somar.local';
  env.ADMIN_DEFAULT_PASSWORD = env.ADMIN_DEFAULT_PASSWORD ?? 'admin123';

  return env;
}

/**
 * Converte um valor em número inteiro, aplicando fallback quando ausente/vazio.
 *
 * @param value Valor bruto da variável.
 * @param fallback Valor usado quando ausente ou vazio.
 * @param name Nome da variável (para mensagem de erro).
 * @returns O inteiro parseado.
 */
function parseIntValue(value: unknown, fallback: number, name: string): number {
  if (value === undefined || value === null || value === '') {
    return fallback;
  }
  const parsed = Number(value);
  if (Number.isNaN(parsed)) {
    throw new Error(
      `Variável de ambiente ${name} inválida: "${stringifyValue(value)}" não é um número.`,
    );
  }
  return parsed;
}

/**
 * Converte um valor em booleano, aplicando fallback quando ausente/vazio.
 *
 * @param value Valor bruto da variável.
 * @param fallback Valor usado quando ausente ou vazio.
 * @param name Nome da variável (para mensagem de erro).
 * @returns O booleano parseado.
 */
function parseBooleanValue(
  value: unknown,
  fallback: boolean,
  name: string,
): boolean {
  if (value === undefined || value === null || value === '') {
    return fallback;
  }
  if (typeof value === 'boolean') {
    return value;
  }
  const str = stringifyValue(value).toLowerCase();
  if (str === 'true' || str === '1') {
    return true;
  }
  if (str === 'false' || str === '0') {
    return false;
  }
  throw new Error(
    `Variável de ambiente ${name} inválida: "${stringifyValue(value)}" não é booleano.`,
  );
}

/**
 * Serializa um valor para uso em mensagens de erro, sem disparar o lint
 * `no-base-to-string` (objetos são convertidos via JSON).
 *
 * @param value Valor bruto a serializar.
 * @returns Representação textual do valor.
 */
function stringifyValue(value: unknown): string {
  if (typeof value === 'string') {
    return value;
  }
  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  return JSON.stringify(value);
}
