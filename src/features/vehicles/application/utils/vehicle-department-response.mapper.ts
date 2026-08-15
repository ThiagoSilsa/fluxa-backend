// Types
import type { VehicleDepartmentEntity } from '../../domain/entities/vehicle-department.entity';
import type { VehicleDepartmentResponse } from '../dto/vehicle-department-response';

/**
 * Mapeia o vínculo de departamento padrão para a resposta (nunca expõe a
 * entidade crua — AGENTS.md §3).
 *
 * @param link Vínculo de domínio.
 * @param department Departamento resolvido (id + nome) ou `null`.
 * @returns Vínculo no formato de resposta.
 */
export function toVehicleDepartmentResponse(
  link: VehicleDepartmentEntity,
  department: { id: string; name: string } | null,
): VehicleDepartmentResponse {
  return {
    id: link.id,
    vehicleId: link.vehicleId,
    departmentId: link.departmentId,
    department,
    isActive: link.isActive,
  };
}
