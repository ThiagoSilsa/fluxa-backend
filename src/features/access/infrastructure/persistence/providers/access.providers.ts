// NestJS
import type { Provider } from '@nestjs/common';

// Repositories
import { VEHICLE_ACCESS_REPOSITORY } from '../../../domain/repositories/vehicle-access.repository';

// Implementations
import { VehicleAccessesTypeormRepository } from '../typeorm/vehicle-accesses-typeorm.repository';

/**
 * Providers de DI da feature `access` — repositório e seu Symbol token.
 */
export const accessProviders: Provider[] = [
  VehicleAccessesTypeormRepository,
  {
    provide: VEHICLE_ACCESS_REPOSITORY,
    useExisting: VehicleAccessesTypeormRepository,
  },
];
