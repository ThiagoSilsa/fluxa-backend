// Constants
import type { DevicePlatform } from '../../domain/constants/device-platform.constant';

/**
 * Entrada do use case de criação de dispositivo (já validada pelo
 * controller).
 */
export class CreateDeviceInputDto {
  constructor(
    /** Identificação amigável (ex.: `Tablet Portaria 1`). */
    readonly name: string,
    /** Plataforma do aparelho (imutável após a criação). */
    readonly platform: DevicePlatform,
    /** Portaria vinculada (opcional — deve estar ativa na empresa). */
    readonly entranceId?: string,
  ) {}
}
