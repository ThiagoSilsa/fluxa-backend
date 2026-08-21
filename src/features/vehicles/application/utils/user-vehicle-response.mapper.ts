// Types
import type { UserVehicleWithUserEntity } from '../../domain/entities/user-vehicle.entity';
import type { UserVehicleDriverResponse } from '../dto/user-vehicle-response';

/**
 * Mapeia o vínculo motorista ↔ veículo (com o motorista) para a resposta
 * (nunca expõe a entidade crua — AGENTS.md §3).
 *
 * @param link Vínculo de domínio com o motorista.
 * @returns Vínculo no formato de resposta.
 */
export function toUserVehicleDriverResponse(
  link: UserVehicleWithUserEntity,
): UserVehicleDriverResponse {
  return {
    id: link.id,
    vehicleId: link.vehicleId,
    user: { id: link.user.id, name: link.user.name },
    isPrimary: link.isPrimary,
    canDrive: link.canDrive,
  };
}
