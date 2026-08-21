/**
 * Portaria (por empresa) — entidade de domínio.
 *
 * Espelha a tabela `entrance` (migration `0003`). Independente de
 * departamento (ADR 0006 §5); a desativação preserva o histórico (movimentos,
 * `entry_denial`, devices) e apenas impede novos usos.
 */
export interface EntranceEntity {
  /** Id da portaria. */
  id: string;
  /** Empresa dona da portaria. */
  companyId: string;
  /** Nome da portaria (ex.: `Portaria Principal`). */
  name: string;
  /** Se a portaria está ativa. */
  isActive: boolean;
  /** Data de criação. */
  createdAt: Date;
  /** Data da última atualização. */
  updatedAt: Date;
}
