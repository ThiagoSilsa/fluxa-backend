// NestJS
import type { Provider } from '@nestjs/common';

// Repositories
import { VEHICLE_TYPE_REPOSITORY } from '../../../domain/repositories/vehicle-type.repository';
import { VEHICLE_REPOSITORY } from '../../../domain/repositories/vehicle.repository';

// Implementations
import { VehicleTypesTypeormRepository } from '../typeorm/vehicle-types-typeorm.repository';
import { VehiclesTypeormRepository } from '../typeorm/vehicles-typeorm.repository';

/**
 * Providers de DI da feature `vehicles` — repositórios e seus Symbol tokens.
 */
export const vehiclesProviders: Provider[] = [
  VehicleTypesTypeormRepository,
  {
    provide: VEHICLE_TYPE_REPOSITORY,
    useExisting: VehicleTypesTypeormRepository,
  },
  VehiclesTypeormRepository,
  { provide: VEHICLE_REPOSITORY, useExisting: VehiclesTypeormRepository },
];
