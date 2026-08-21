// Node
import { randomBytes } from 'crypto';

/**
 * Gera o token de sincronização de um dispositivo — 16 bytes em hex (32
 * caracteres, cabe no `varchar(64)` da tabela `device`). ADR 0008 §3.
 *
 * O token é **write-only**: devolvido apenas na criação/rotação e nunca nas
 * respostas de consulta.
 *
 * @returns Token aleatório em hex.
 */
export function generateDeviceToken(): string {
  return randomBytes(16).toString('hex');
}
