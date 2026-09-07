// NestJS
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

// Modules
import { AuthModule } from '../auth/auth.module';
import { AccessRequestsModule } from '../access-requests/access-requests.module';
import { BlocksModule } from '../blocks/blocks.module';
import { DepartmentsModule } from '../departments/departments.module';
import { EntrancesModule } from '../entrances/entrances.module';
import { UsersModule } from '../users/users.module';
import { VehiclesModule } from '../vehicles/vehicles.module';

// Repository
import { VEHICLE_ACCESS_REPOSITORY } from './domain/repositories/vehicle-access.repository';

// Infrastructure
import { accessProviders } from './infrastructure/persistence/providers/access.providers';
import { VehicleAccessOrmEntity } from './infrastructure/persistence/typeorm/vehicle-access.orm-entity';
import { VehicleMovementOrmEntity } from './infrastructure/persistence/typeorm/vehicle-movement.orm-entity';

// Use cases
import { GetOccupancyUseCase } from './application/use-cases/get-occupancy.use-case';
import { GetOpenAccessUseCase } from './application/use-cases/get-open-access.use-case';
import { RegisterEntryUseCase } from './application/use-cases/register-entry.use-case';
import { RegisterExitUseCase } from './application/use-cases/register-exit.use-case';

// Presentation
import { AccessController } from './presentation/http/controllers/access.controller';

/**
 * Módulo do núcleo de acesso (ADR 0010 — M3): entrada, saída, conferência e
 * ocupação.
 *
 * Consome as dependências na ordem definida: `BlocksModule`
 * (`vehicle_block`/`entry_denial` — nega + impedimento automático),
 * `AccessRequestsModule` (`access_request.entry_authorized` — entrada
 * temporária), `VehiclesModule` (veículo/condutor/departamento padrão),
 * `DepartmentsModule` (capacidade) e `UsersModule` (nomes). **Sem ciclo**:
 * nenhum desses importa `access`.
 */
@Module({
  imports: [
    AuthModule,
    UsersModule,
    VehiclesModule,
    DepartmentsModule,
    BlocksModule,
    AccessRequestsModule,
    EntrancesModule,
    TypeOrmModule.forFeature([
      VehicleAccessOrmEntity,
      VehicleMovementOrmEntity,
    ]),
  ],
  providers: [
    ...accessProviders,
    RegisterEntryUseCase,
    RegisterExitUseCase,
    GetOpenAccessUseCase,
    GetOccupancyUseCase,
  ],
  controllers: [AccessController],
  exports: [VEHICLE_ACCESS_REPOSITORY],
})
export class AccessModule {}
