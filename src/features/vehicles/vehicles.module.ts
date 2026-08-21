// NestJS
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

// Modules
import { AuthModule } from '../auth/auth.module';
import { DepartmentsModule } from '../departments/departments.module';
import { ImportsModule } from '../imports/imports.module';

// Shared
import {
  QUEUE_NAMES,
  registerImportQueue,
} from '../../shared/queue/queue.module';

// Repositories
import { USER_VEHICLE_REPOSITORY } from './domain/repositories/user-vehicle.repository';
import { VEHICLE_DEPARTMENT_REPOSITORY } from './domain/repositories/vehicle-department.repository';
import { VEHICLE_QR_REPOSITORY } from './domain/repositories/vehicle-qr.repository';
import { VEHICLE_TYPE_REPOSITORY } from './domain/repositories/vehicle-type.repository';
import { VEHICLE_REPOSITORY } from './domain/repositories/vehicle.repository';

// Infrastructure
import { vehiclesProviders } from './infrastructure/persistence/providers/vehicles.providers';
import { UserVehicleOrmEntity } from './infrastructure/persistence/typeorm/user-vehicle.orm-entity';
import { UserOrmEntity } from '../users/infrastructure/persistence/typeorm/user.orm-entity';
import { VehicleDepartmentOrmEntity } from './infrastructure/persistence/typeorm/vehicle-department.orm-entity';
import { VehicleQrOrmEntity } from './infrastructure/persistence/typeorm/vehicle-qr.orm-entity';
import { VehicleTypeOrmEntity } from './infrastructure/persistence/typeorm/vehicle-type.orm-entity';
import { VehicleOrmEntity } from './infrastructure/persistence/typeorm/vehicle.orm-entity';

// Use cases
import { AssignDriverToVehicleUseCase } from './application/use-cases/assign-driver-to-vehicle.use-case';
import { CreateVehicleTypeUseCase } from './application/use-cases/create-vehicle-type.use-case';
import { CreateVehicleUseCase } from './application/use-cases/create-vehicle.use-case';
import { DeleteVehicleTypeUseCase } from './application/use-cases/delete-vehicle-type.use-case';
import { DeleteVehicleUseCase } from './application/use-cases/delete-vehicle.use-case';
import { EmitVehicleQrUseCase } from './application/use-cases/emit-vehicle-qr.use-case';
import { GetVehicleDepartmentUseCase } from './application/use-cases/get-vehicle-department.use-case';
import { GetVehicleQrUseCase } from './application/use-cases/get-vehicle-qr.use-case';
import { GetVehicleTypeUseCase } from './application/use-cases/get-vehicle-type.use-case';
import { GetVehicleUseCase } from './application/use-cases/get-vehicle.use-case';
import { ListVehicleDriversUseCase } from './application/use-cases/list-vehicle-drivers.use-case';
import { ListDriverCandidatesUseCase } from './application/use-cases/list-driver-candidates.use-case';
import { ListVehicleTypesUseCase } from './application/use-cases/list-vehicle-types.use-case';
import { ListVehiclesUseCase } from './application/use-cases/list-vehicles.use-case';
import { ImportUserVehiclesUseCase } from './application/use-cases/import-user-vehicles.use-case';
import { ImportVehiclesUseCase } from './application/use-cases/import-vehicles.use-case';
import { ReissueVehicleQrUseCase } from './application/use-cases/reissue-vehicle-qr.use-case';
import { RemoveVehicleDepartmentUseCase } from './application/use-cases/remove-vehicle-department.use-case';
import { RemoveVehicleDriverUseCase } from './application/use-cases/remove-vehicle-driver.use-case';
import { ResolveVehicleQrUseCase } from './application/use-cases/resolve-vehicle-qr.use-case';
import { RevokeVehicleQrUseCase } from './application/use-cases/revoke-vehicle-qr.use-case';
import { SetVehicleDepartmentUseCase } from './application/use-cases/set-vehicle-department.use-case';
import { UpdateVehicleDriverUseCase } from './application/use-cases/update-vehicle-driver.use-case';
import { UpdateVehicleTypeUseCase } from './application/use-cases/update-vehicle-type.use-case';
import { UpdateVehicleUseCase } from './application/use-cases/update-vehicle.use-case';

// Processors
import { ImportUserVehiclesProcessor } from './application/processors/import-user-vehicles.processor';
import { ImportVehiclesProcessor } from './application/processors/import-vehicles.processor';

// Presentation
import { VehicleDepartmentController } from './presentation/http/controllers/vehicle-department.controller';
import { VehicleDriverCandidatesController } from './presentation/http/controllers/vehicle-driver-candidates.controller';
import { VehicleDriversController } from './presentation/http/controllers/vehicle-drivers.controller';
import { VehicleQrController } from './presentation/http/controllers/vehicle-qr.controller';
import { QrCodesController } from './presentation/http/controllers/qr-codes.controller';
import { VehicleTypesController } from './presentation/http/controllers/vehicle-types.controller';
import { VehiclesController } from './presentation/http/controllers/vehicles.controller';
import { VehiclesImportController } from './presentation/http/controllers/vehicles-import.controller';
import { UserVehiclesImportController } from './presentation/http/controllers/user-vehicles-import.controller';

/**
 * Módulo de veículos (CRUD de `vehicle_type`/`vehicle` + vínculos
 * `vehicle_department` e `user_vehicle` — ADR 0006).
 *
 * Importa `AuthModule` para os use cases de JWT/validação dos guards e o
 * `USER_COMPANY_REPOSITORY` (vínculo ativo do motorista); importa
 * `DepartmentsModule` para o `DEPARTMENT_REPOSITORY` (validação do
 * departamento padrão e `parameters` da listagem). **Sem ciclo**: departments
 * não importa vehicles.
 */
@Module({
  imports: [
    AuthModule,
    DepartmentsModule,
    ImportsModule,
    registerImportQueue(QUEUE_NAMES.IMPORT_VEHICLES),
    registerImportQueue(QUEUE_NAMES.IMPORT_USER_VEHICLES),
    TypeOrmModule.forFeature([
      VehicleTypeOrmEntity,
      VehicleOrmEntity,
      VehicleDepartmentOrmEntity,
      UserVehicleOrmEntity,
      VehicleQrOrmEntity,
      UserOrmEntity,
    ]),
  ],
  providers: [
    ...vehiclesProviders,
    CreateVehicleTypeUseCase,
    ListVehicleTypesUseCase,
    GetVehicleTypeUseCase,
    UpdateVehicleTypeUseCase,
    DeleteVehicleTypeUseCase,
    CreateVehicleUseCase,
    ListVehiclesUseCase,
    GetVehicleUseCase,
    UpdateVehicleUseCase,
    DeleteVehicleUseCase,
    SetVehicleDepartmentUseCase,
    GetVehicleDepartmentUseCase,
    RemoveVehicleDepartmentUseCase,
    AssignDriverToVehicleUseCase,
    ListVehicleDriversUseCase,
    UpdateVehicleDriverUseCase,
    RemoveVehicleDriverUseCase,
    ListDriverCandidatesUseCase,
    EmitVehicleQrUseCase,
    GetVehicleQrUseCase,
    ReissueVehicleQrUseCase,
    RevokeVehicleQrUseCase,
    ResolveVehicleQrUseCase,
    ImportVehiclesUseCase,
    ImportVehiclesProcessor,
    ImportUserVehiclesUseCase,
    ImportUserVehiclesProcessor,
  ],
  controllers: [
    // Antes de `VehiclesController` para que `/vehicles/driver-candidates`
    // (estática) não caia no `GET /vehicles/:id` (ParseUUIDPipe → 400).
    VehicleDriverCandidatesController,
    VehicleTypesController,
    VehiclesController,
    VehicleDepartmentController,
    VehicleDriversController,
    VehiclesImportController,
    UserVehiclesImportController,
    VehicleQrController,
    QrCodesController,
  ],
  exports: [
    VEHICLE_REPOSITORY,
    VEHICLE_TYPE_REPOSITORY,
    VEHICLE_DEPARTMENT_REPOSITORY,
    USER_VEHICLE_REPOSITORY,
    VEHICLE_QR_REPOSITORY,
  ],
})
export class VehiclesModule {}
