// NestJS
import type { Provider } from '@nestjs/common';

// Repositories
import { ACCESS_RECORD_REPOSITORY } from '../../../domain/repositories/access-record.repository';
import { VEHICLE_ACCESS_REPOSITORY } from '../../../domain/repositories/vehicle-access.repository';

// Implementations
import { AccessRecordsTypeormRepository } from '../typeorm/access-records-typeorm.repository';
import { VehicleAccessesTypeormRepository } from '../typeorm/vehicle-accesses-typeorm.repository';

/**
 * Providers de DI da feature `access` — repositórios e seus Symbol tokens.
 */
export const accessProviders: Provider[] = [
  VehicleAccessesTypeormRepository,
  {
    provide: VEHICLE_ACCESS_REPOSITORY,
    useExisting: VehicleAccessesTypeormRepository,
  },
  AccessRecordsTypeormRepository,
  {
    provide: ACCESS_RECORD_REPOSITORY,
    useExisting: AccessRecordsTypeormRepository,
  },
];
