/**
 * Tipos de importação suportados (enum `import_job_type` do Postgres —
 * migration `0005` + `DEPARTMENT` na `0011`; ADR 0007 §1).
 */
export enum ImportJobType {
  DEPARTMENT = 'DEPARTMENT',
  VEHICLE = 'VEHICLE',
  USER = 'USER',
  USER_VEHICLE = 'USER_VEHICLE',
}

/**
 * Status de um job de importação (enum `import_job_status` do Postgres —
 * migration `0005`; ADR 0007 §3).
 *
 * No v1 (fail-fast) são produzidos `PENDING`, `PROCESSING`, `DONE` e
 * `FAILED`. `PARTIAL` permanece no enum como **reserva** para uma eventual
 * importação parcial futura — não é emitido.
 */
export enum ImportJobStatus {
  PENDING = 'PENDING',
  PROCESSING = 'PROCESSING',
  DONE = 'DONE',
  FAILED = 'FAILED',
  PARTIAL = 'PARTIAL',
}
