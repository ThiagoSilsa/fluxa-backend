// Types
import type { RolePermissionEntity } from '../entities/role-permission.entity';

/**
 * Symbol token de injeção do `RolePermissionRepository`.
 */
export const ROLE_PERMISSION_REPOSITORY = Symbol('ROLE_PERMISSION_REPOSITORY');

/**
 * Contrato do repositório de vínculo cargo ↔ permissão.
 *
 * Todas as operações são escopadas por `company_id` — vínculos nunca vazam
 * entre empresas (ADR 0002/0004).
 */
export interface RolePermissionRepository {
  /**
   * Associa uma permissão do catálogo global a um cargo da empresa.
   *
   * @param companyId Empresa da sessão.
   * @param roleId Cargo.
   * @param permissionId Permissão (catálogo global).
   * @returns Promise resolvida quando o vínculo é gravado.
   */
  associate(
    companyId: string,
    roleId: string,
    permissionId: string,
  ): Promise<void>;

  /**
   * Remove um vínculo cargo ↔ permissão da empresa.
   *
   * @param companyId Empresa da sessão.
   * @param roleId Cargo.
   * @param permissionId Permissão.
   * @returns `true` quando um vínculo foi removido.
   */
  remove(
    companyId: string,
    roleId: string,
    permissionId: string,
  ): Promise<boolean>;

  /**
   * Lista as permissões vinculadas a um cargo da empresa (com a permissão).
   *
   * @param roleId Cargo.
   * @param companyId Empresa da sessão.
   * @returns Vínculos ordenados por código da permissão.
   */
  listByRoleIdAndCompanyId(
    roleId: string,
    companyId: string,
  ): Promise<RolePermissionEntity[]>;

  /**
   * Verifica se um vínculo existe na empresa.
   *
   * @param companyId Empresa da sessão.
   * @param roleId Cargo.
   * @param permissionId Permissão.
   * @returns `true` quando o vínculo existe.
   */
  exists(
    companyId: string,
    roleId: string,
    permissionId: string,
  ): Promise<boolean>;
}
