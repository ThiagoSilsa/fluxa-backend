// Types
import type { VehicleQrEntity } from '../../domain/entities/vehicle-qr.entity';
import type { VehicleQrResponse } from '../dto/vehicle-qr-response';

/**
 * Mapeia a entidade de domínio para a resposta de QR code de veículo (nunca
 * expõe a entidade crua — AGENTS.md §3).
 *
 * @param qr QR de domínio.
 * @returns QR no formato de resposta.
 */
export function toVehicleQrResponse(qr: VehicleQrEntity): VehicleQrResponse {
  return {
    id: qr.id,
    vehicleId: qr.vehicleId,
    code: qr.code,
    isActive: qr.isActive,
    issuedBy: qr.issuedBy,
    createdAt: qr.createdAt.toISOString(),
  };
}
