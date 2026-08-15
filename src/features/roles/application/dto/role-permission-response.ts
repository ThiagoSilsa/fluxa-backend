// Types
import type { PermissionResponse } from './role-response';

/**
 * Resposta da listagem das permissões de um cargo.
 *
 * `permissions` são as já vinculadas; `available` é o catálogo global (para a
 * web montar os checkboxes de associação).
 */
export interface ListRolePermissionsResponse {
  /** Cargo consultado. */
  roleId: string;
  /** Permissões já vinculadas ao cargo. */
  permissions: PermissionResponse[];
  /** Catálogo global disponível para associar. */
  available: PermissionResponse[];
}
