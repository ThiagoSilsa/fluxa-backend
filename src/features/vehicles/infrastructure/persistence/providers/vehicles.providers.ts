// NestJS
import type { Provider } from '@nestjs/common';

// Repositories
import { USER_VEHICLE_REPOSITORY } from '../../../domain/repositories/user-vehicle.repository';
import { VEHICLE_DEPARTMENT_REPOSITORY } from '../../../domain/repositories/vehicle-department.repository';
import { VEHICLE_QR_REPOSITORY } from '../../../domain/repositories/vehicle-qr.repository';
import { VEHICLE_TYPE_REPOSITORY } from '../../../domain/repositories/vehicle-type.repository';
import { VEHICLE_REPOSITORY } from '../../../domain/repositories/vehicle.repository';

// Implementations
import { UserVehiclesTypeormRepository } from '../typeorm/user-vehicles-typeorm.repository';
import { VehicleDepartmentsTypeormRepository } from '../typeorm/vehicle-departments-typeorm.repository';
import { VehicleQrTypeormRepository } from '../typeorm/vehicle-qr-typeorm.repository';
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
  VehicleDepartmentsTypeormRepository,
  {
    provide: VEHICLE_DEPARTMENT_REPOSITORY,
    useExisting: VehicleDepartmentsTypeormRepository,
  },
  UserVehiclesTypeormRepository,
  {
    provide: USER_VEHICLE_REPOSITORY,
    useExisting: UserVehiclesTypeormRepository,
  },
  VehicleQrTypeormRepository,
  { provide: VEHICLE_QR_REPOSITORY, useExisting: VehicleQrTypeormRepository },
];
