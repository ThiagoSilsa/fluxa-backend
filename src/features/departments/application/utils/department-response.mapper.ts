// Types
import type { DepartmentEntity } from '../../domain/entities/department.entity';
import type { DepartmentResponse } from '../dto/department-response';

/**
 * Mapeia a entidade de domínio para a resposta de departamento (nunca expõe a
 * entidade crua — AGENTS.md §3).
 *
 * @param department Departamento de domínio.
 * @returns Departamento no formato de resposta.
 */
export function toDepartmentResponse(
  department: DepartmentEntity,
): DepartmentResponse {
  return {
    id: department.id,
    name: department.name,
    description: department.description,
    parkingSpace: department.parkingSpace,
    isActive: department.isActive,
  };
}
