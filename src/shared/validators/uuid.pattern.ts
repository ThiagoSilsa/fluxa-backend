/**
 * Regex de UUID que aceita **qualquer nibble de versão** (0–8).
 *
 * O `@IsUUID()` do class-validator rejeita UUIDs com version nibble fora de
 * `[1-8]` — e os **IDs seedados** do sistema (ex.:
 * `10000000-0000-0000-0000-000000000001`) usam nibble `0` (válido para o
 * Postgres `uuid`, mas não para o `uuid` package). Para esses IDs legítimos,
 * validamos apenas o formato.
 */
export const UUID_ANY_VERSION_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
