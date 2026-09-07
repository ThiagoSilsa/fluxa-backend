// Types
import type { VehicleAccessEntity } from '../../domain/entities/vehicle-access.entity';
import type { VehicleMovementEntity } from '../../domain/entities/vehicle-movement.entity';
import type {
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
 * Mapeia um par visita + movimento para a resposta.
 *
 * @param access Visita de domínio.
 * @param movement Movimento de domínio.
 * @returns Par no formato de resposta.
 */
export function toClosedAccessResponse(
  access: VehicleAccessEntity,
  movement: VehicleMovementEntity,
): ClosedAccessResponse {
  return {
    access: toAccessResponse(access),
    movement: toMovementResponse(movement),
  };
}
