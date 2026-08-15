// Types
import type { RoleEntity } from '../../domain/entities/role.entity';
import type { RoleResponse } from '../dto/role-response';

/**
 * Mapeia a entidade de domínio para a resposta de cargo (nunca expõe a
 * entidade crua — AGENTS.md §3).
 *
 * @param role Cargo de domínio.
 * @returns Cargo no formato de resposta.
 */
export function toRoleResponse(role: RoleEntity): RoleResponse {
  return {
    id: role.id,
    name: role.name,
    description: role.description,
    isAdmin: role.isAdmin,
    isActive: role.isActive,
  };
}
