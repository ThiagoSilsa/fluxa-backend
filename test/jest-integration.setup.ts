/**
 * Setup global dos testes de integração (`test/jest-integration.json`).
 *
 * Suprime no stderr o ruído de `ECONNREFUSED` do Redis quando módulos com
 * BullMQ são carregados sem um Redis disponível. Módulos que dependem de
 * Redis de verdade sobem o próprio container (ver
 * `src/test/support/redis-test-container.ts`).
 */

type StderrWriteFn = (
  chunk: string | Uint8Array,
  encoding?: BufferEncoding | ((err?: Error | null) => void),
  callback?: (err?: Error | null) => void,
) => boolean;

const originalStderrWrite = process.stderr.write.bind(
  process.stderr,
) as StderrWriteFn;

process.stderr.write = (
  chunk: string | Uint8Array,
  encoding?: BufferEncoding | ((err?: Error | null) => void),
  callback?: (err?: Error | null) => void,
): boolean => {
  const text = typeof chunk === 'string' ? chunk : chunk.toString();
  if (text.includes('ECONNREFUSED')) {
    return true;
  }
  if (typeof encoding === 'function') {
    return originalStderrWrite(chunk, encoding);
  }
  return originalStderrWrite(chunk, encoding, callback);
};
