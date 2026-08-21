/**
 * Cargo (por empresa) — entidade de domínio.
 *
 * Espelha a tabela `role` (migration `0001`). `isAdmin` concede acesso total à
 * administração (ADR 0004) e torna o cargo imutável pelo CRUD.
 */
export interface RoleEntity {
  /** Id do cargo. */
  id: string;
  /** Empresa dona do cargo. */
  companyId: string;
  /** Nome do cargo (ex.: `Porteiro`). */
  name: string;
  /** Descrição opcional. */
  description: string | null;
  /** Cargo de administração (acesso total — protegido pelo CRUD). */
  isAdmin: boolean;
  /** Se o cargo está ativo (desativar não remove vínculos). */
  isActive: boolean;
  /** Data de criação. */
  createdAt: Date;
  /** Data da última atualização. */
  updatedAt: Date;
}
