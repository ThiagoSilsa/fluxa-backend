// Types
import type { VehicleTypeEntity } from '../../domain/entities/vehicle-type.entity';
import type { VehicleTypeResponse } from '../dto/vehicle-type-response';

/**
 * Mapeia a entidade de domínio para a resposta de tipo de veículo (nunca
 * expõe a entidade crua — AGENTS.md §3).
 *
 * @param vehicleType Tipo de veículo de domínio.
 * @returns Tipo de veículo no formato de resposta.
 */
export function toVehicleTypeResponse(
  vehicleType: VehicleTypeEntity,
): VehicleTypeResponse {
  return {
    id: vehicleType.id,
    code: vehicleType.code,
    name: vehicleType.name,
    description: vehicleType.description,
    isFleet: vehicleType.isFleet,
    isActive: vehicleType.isActive,
  };
}
