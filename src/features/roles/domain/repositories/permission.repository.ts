// Types
import type { PermissionEntity } from '../entities/permission.entity';

/**
 * Symbol token de injeção do `PermissionRepository`.
 */
export const PERMISSION_REPOSITORY = Symbol('PERMISSION_REPOSITORY');

/**
 * Contrato do repositório do catálogo global de permissões.
 *
 * `permission` é catálogo global (sem `company_id`) — leitura apenas (ADR
 * 0004): a aplicação nunca cria/altera permissões.
 */
export interface PermissionRepository {
  /**
   * Lista todo o catálogo de permissões, ordenado por código.
   *
   * @returns Catálogo global completo.
   */
  listAll(): Promise<PermissionEntity[]>;

  /**
   * Verifica se uma permissão existe no catálogo global.
   *
   * @param id Id da permissão.
   * @returns `true` quando a permissão existe.
   */
  existsById(id: string): Promise<boolean>;
}
