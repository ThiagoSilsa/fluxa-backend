// Types
import type { VehicleWithTypeEntity } from '../../domain/entities/vehicle.entity';
import type { VehicleResponse } from '../dto/vehicle-response';

/**
 * Mapeia a entidade de domínio (com o tipo agregado) para a resposta de
 * veículo (nunca expõe a entidade crua — AGENTS.md §3).
 *
 * @param vehicle Veículo de domínio com o tipo.
 * @returns Veículo no formato de resposta.
 */
export function toVehicleResponse(
  vehicle: VehicleWithTypeEntity,
): VehicleResponse {
  return {
    id: vehicle.id,
    plate: vehicle.plate,
    model: vehicle.model,
    color: vehicle.color,
    observation: vehicle.observation,
    isBlocked: vehicle.isBlocked,
    freePass: vehicle.freePass,
    vehicleTypeId: vehicle.vehicleTypeId,
    vehicleType: vehicle.vehicleType,
    isActive: vehicle.isActive,
    createdAt: vehicle.createdAt.toISOString(),
  };
}
