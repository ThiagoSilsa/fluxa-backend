// NestJS
import type { Provider } from '@nestjs/common';

// Repository
import { DEVICE_REPOSITORY } from '../../../domain/repositories/device.repository';

// Implementation
import { DevicesTypeormRepository } from '../typeorm/devices-typeorm.repository';

/**
 * Providers de DI da feature `devices` — repositório e seu Symbol token.
 */
export const devicesProviders: Provider[] = [
  DevicesTypeormRepository,
  { provide: DEVICE_REPOSITORY, useExisting: DevicesTypeormRepository },
];
