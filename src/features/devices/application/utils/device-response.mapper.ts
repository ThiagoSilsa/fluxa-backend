// Types
import type { DeviceWithEntranceEntity } from '../../domain/entities/device.entity';
import type { DeviceResponse } from '../dto/device-response';

/**
 * Mapeia a entidade de domínio (com a portaria agregada) para a resposta de
 * dispositivo (nunca expõe a entidade crua — AGENTS.md §3). O `token` nunca é
 * exposto (write-only — ADR 0008 §3).
 *
 * @param device Dispositivo de domínio com a portaria.
 * @returns Dispositivo no formato de resposta.
 */
export function toDeviceResponse(
  device: DeviceWithEntranceEntity,
): DeviceResponse {
  return {
    id: device.id,
    name: device.name,
    platform: device.platform,
    appVersion: device.appVersion,
    entranceId: device.entranceId,
    entrance: device.entrance,
    lastSyncAt: device.lastSyncAt ? device.lastSyncAt.toISOString() : null,
    isActive: device.isActive,
    createdAt: device.createdAt.toISOString(),
    updatedAt: device.updatedAt.toISOString(),
  };
}
