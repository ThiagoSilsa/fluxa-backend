// Types
import type {
  DeviceEntity,
  DeviceWithEntranceEntity,
} from '../../domain/entities/device.entity';

/**
 * Resumo de portaria agregado ao dispositivo.
 */
export interface DeviceEntranceSummary {
  /** Id da portaria. */
  id: string;
  /** Nome da portaria. */
  name: string;
}

/**
 * Agrega o resumo da portaria a um dispositivo (para o response mapper).
 *
 * @param device Dispositivo de domínio (sem a portaria).
 * @param entrance Resumo da portaria vinculada ou `null`.
 * @returns Dispositivo com a portaria agregada.
 */
export function buildDeviceWithEntrance(
  device: DeviceEntity,
  entrance: DeviceEntranceSummary | null,
): DeviceWithEntranceEntity {
  return { ...device, entrance };
}
