// Types
import type { AccessFicha } from './resolve-access-ficha.util';
import type { VehicleAccessEntity } from '../../domain/entities/vehicle-access.entity';
import type { VehicleMovementEntity } from '../../domain/entities/vehicle-movement.entity';
import type {
  AccessFichaDriverResponse,
  AccessFichaVehicleResponse,
  AccessResponse,
  ClosedAccessResponse,
  MovementResponse,
} from '../dto/access-response';

/**
 * Mapeia a entidade de domínio para a resposta de visita (nunca expõe a
 * entidade crua — AGENTS.md §3).
 *
 * @param access Visita de domínio.
 * @returns Visita no formato de resposta.
 */
export function toAccessResponse(access: VehicleAccessEntity): AccessResponse {
  return {
    id: access.id,
    vehicleId: access.vehicleId,
    temporaryPlate: access.temporaryPlate,
    driverUserId: access.driverUserId,
    temporaryDriverName: access.temporaryDriverName,
    departmentId: access.departmentId,
    accessRequestId: access.accessRequestId,
    overCapacity: access.overCapacity,
    status: access.status,
    forcedExit: access.forcedExit,
    entryAt: access.entryAt ? access.entryAt.toISOString() : null,
    exitAt: access.exitAt ? access.exitAt.toISOString() : null,
    closedBy: access.closedBy,
    closedAt: access.closedAt ? access.closedAt.toISOString() : null,
  };
}

/**
 * Mapeia a entidade de domínio para a resposta de movimento (ledger).
 *
 * @param movement Movimento de domínio.
 * @returns Movimento no formato de resposta.
 */
export function toMovementResponse(
  movement: VehicleMovementEntity,
): MovementResponse {
  return {
    id: movement.id,
    accessId: movement.accessId,
    vehicleId: movement.vehicleId,
    type: movement.type,
    occurredAt: movement.occurredAt.toISOString(),
    plateSnapshot: movement.plateSnapshot,
    driverUserId: movement.driverUserId,
    departmentId: movement.departmentId,
    source: movement.source,
    entranceId: movement.entranceId,
    doormanId: movement.doormanId,
    syncStatus: movement.syncStatus,
  };
}

/**
 * Mapeia um par visita + movimento para a resposta, com a ficha resolvida
 * (condutor, setor e veículo) — usada na conferência e no resultado da saída.
 *
 * @param access Visita de domínio.
 * @param movement Movimento de domínio.
 * @param ficha Ficha resolvida do acesso.
 * @returns Par no formato de resposta.
 */
export function toClosedAccessResponse(
  access: VehicleAccessEntity,
  movement: VehicleMovementEntity,
  ficha: AccessFicha,
): ClosedAccessResponse {
  return {
    access: toAccessResponse(access),
    movement: toMovementResponse(movement),
    driver: toFichaDriverResponse(ficha.driver),
    departmentName: ficha.departmentName,
    vehicle: toFichaVehicleResponse(ficha.vehicle),
  };
}

/**
 * Mapeia o condutor da ficha para a resposta.
 *
 * @param driver Condutor da ficha.
 * @returns Condutor no formato de resposta.
 */
export function toFichaDriverResponse(
  driver: AccessFicha['driver'],
): AccessFichaDriverResponse {
  return { id: driver.id, name: driver.name, phone: driver.phone };
}

/**
 * Mapeia o veículo da ficha para a resposta.
 *
 * @param vehicle Veículo da ficha (ou `null`).
 * @returns Veículo no formato de resposta.
 */
export function toFichaVehicleResponse(
  vehicle: AccessFicha['vehicle'],
): AccessFichaVehicleResponse | null {
  if (!vehicle) {
    return null;
  }
  return {
    id: vehicle.id,
    plate: vehicle.plate,
    model: vehicle.model,
    color: vehicle.color,
    vehicleType: vehicle.vehicleType,
    freePass: vehicle.freePass,
  };
}
