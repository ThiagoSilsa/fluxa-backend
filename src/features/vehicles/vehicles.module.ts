// NestJS
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

// Modules
import { AuthModule } from '../auth/auth.module';

// Repositories
import { VEHICLE_TYPE_REPOSITORY } from './domain/repositories/vehicle-type.repository';
import { VEHICLE_REPOSITORY } from './domain/repositories/vehicle.repository';

// Infrastructure
import { vehiclesProviders } from './infrastructure/persistence/providers/vehicles.providers';
import { VehicleTypeOrmEntity } from './infrastructure/persistence/typeorm/vehicle-type.orm-entity';
import { VehicleOrmEntity } from './infrastructure/persistence/typeorm/vehicle.orm-entity';

// Use cases
import { CreateVehicleTypeUseCase } from './application/use-cases/create-vehicle-type.use-case';
import { CreateVehicleUseCase } from './application/use-cases/create-vehicle.use-case';
import { DeactivateVehicleTypeUseCase } from './application/use-cases/deactivate-vehicle-type.use-case';
import { DeactivateVehicleUseCase } from './application/use-cases/deactivate-vehicle.use-case';
import { GetVehicleTypeUseCase } from './application/use-cases/get-vehicle-type.use-case';
import { GetVehicleUseCase } from './application/use-cases/get-vehicle.use-case';
import { ListVehicleTypesUseCase } from './application/use-cases/list-vehicle-types.use-case';
import { ListVehiclesUseCase } from './application/use-cases/list-vehicles.use-case';
import { UpdateVehicleTypeUseCase } from './application/use-cases/update-vehicle-type.use-case';
import { UpdateVehicleUseCase } from './application/use-cases/update-vehicle.use-case';

// Presentation
import { VehicleTypesController } from './presentation/http/controllers/vehicle-types.controller';
import { VehiclesController } from './presentation/http/controllers/vehicles.controller';

/**
 * Módulo de veículos (CRUD de `vehicle_type` e `vehicle` — ADR 0006).
 *
 * Importa `AuthModule` para os use cases de JWT/validação usados pelos guards
 * compartilhados (`JwtAuthGuard`, `PermissionsGuard`). Exporta os repositórios
 * para a Fase 3 (vínculos `vehicle_department`/`user_vehicle`).
 */
@Module({
  imports: [
    AuthModule,
    TypeOrmModule.forFeature([VehicleTypeOrmEntity, VehicleOrmEntity]),
  ],
  providers: [
    ...vehiclesProviders,
    CreateVehicleTypeUseCase,
    ListVehicleTypesUseCase,
    GetVehicleTypeUseCase,
    UpdateVehicleTypeUseCase,
    DeactivateVehicleTypeUseCase,
    CreateVehicleUseCase,
    ListVehiclesUseCase,
    GetVehicleUseCase,
    UpdateVehicleUseCase,
    DeactivateVehicleUseCase,
  ],
  controllers: [VehicleTypesController, VehiclesController],
  exports: [VEHICLE_REPOSITORY, VEHICLE_TYPE_REPOSITORY],
})
export class VehiclesModule {}
