/**
 * Deriva o código de uma mensagem de resposta — o identificador que o cliente
 * usa para achar o texto no idioma ativo (ADR 0016 §1).
 *
 * A mensagem é normalizada (NFD → sem acentos, pontuação vira `_` →
 * maiúsculas) e vira o código; mensagem que começa com dígito recebe o prefixo
 * `ERROR_`. É o **mesmo** algoritmo do filtro global de exceções — a diferença
 * é que aqui ele também serve às respostas de resultado (entrada registrada,
 * aviso de bloqueio), que não passam pelo filtro (ADR 0016 §2).
 *
 * A mensagem faz parte do contrato: reescrever um texto existente muda o código
 * e exige ressincronizar o catálogo de tradução do cliente.
 *
 * Função pura — sem DataSource, sem dependências (AGENTS.md §4).
 *
 * @param message Mensagem devolvida pelo servidor (ex.: `Linha 3: name inválido.`).
 * @returns Código normalizado, ou `undefined` quando a mensagem não gera código.
 */
export function deriveErrorCode(
  message: string | null | undefined,
): string | undefined {
  if (!message) {
    return undefined;
  }

  const normalized = message
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .replace(/_+/g, '_')
    .toUpperCase();

  if (normalized.length === 0) {
    return undefined;
  }

  return /^\d/.test(normalized) ? `ERROR_${normalized}` : normalized;
}

/**
 * Código de reserva para resposta de resultado cuja mensagem não gera código.
 *
 * Sem tradução no cliente: a interface mostra a mensagem genérica de erro no
 * idioma ativo (ADR 0016 §1) — nunca o texto do servidor.
 */
export const UNKNOWN_ERROR_CODE = 'UNKNOWN_ERROR';
