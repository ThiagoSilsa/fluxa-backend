// Types
import type { PermissionEntity } from './permission.entity';

/**
 * Vínculo cargo ↔ permissão (por empresa) — entidade de domínio.
 *
 * Espelha a tabela `role_permission` (migration `0001`): unique
 * `(company_id, role_id, permission_id)` — sem duplicidade.
 */
export interface RolePermissionEntity {
  /** Id do vínculo. */
  id: string;
  /** Empresa da sessão. */
  companyId: string;
  /** Cargo vinculado. */
  roleId: string;
  /** Permissão vinculada. */
  permissionId: string;
  /** Permissão (relação carregada). */
  permission: PermissionEntity;
}
