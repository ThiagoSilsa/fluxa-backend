// NestJS
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

// Modules
import { AuthModule } from '../auth/auth.module';
import { UsersModule } from '../users/users.module';
import { VehiclesModule } from '../vehicles/vehicles.module';

// Repository
import { BLOCK_REQUEST_REPOSITORY } from './domain/repositories/block-request.repository';
import { ENTRY_DENIAL_REPOSITORY } from './domain/repositories/entry-denial.repository';
import { VEHICLE_BLOCK_REPOSITORY } from './domain/repositories/vehicle-block.repository';

// Infrastructure
import { blocksProviders } from './infrastructure/persistence/providers/blocks.providers';
import { BlockRequestOrmEntity } from './infrastructure/persistence/typeorm/block-request.orm-entity';
import { EntryDenialOrmEntity } from './infrastructure/persistence/typeorm/entry-denial.orm-entity';
import { VehicleBlockOrmEntity } from './infrastructure/persistence/typeorm/vehicle-block.orm-entity';

// Use cases
import { ApproveBlockRequestUseCase } from './application/use-cases/approve-block-request.use-case';
import { CancelBlockRequestUseCase } from './application/use-cases/cancel-block-request.use-case';
import { CreateBlockRequestUseCase } from './application/use-cases/create-block-request.use-case';
import { CreateVehicleBlockUseCase } from './application/use-cases/create-vehicle-block.use-case';
import { GetVehicleBlockUseCase } from './application/use-cases/get-vehicle-block.use-case';
import { ListBlockRequestsUseCase } from './application/use-cases/list-block-requests.use-case';
import { ListVehicleBlocksUseCase } from './application/use-cases/list-vehicle-blocks.use-case';
import { RegisterEntryDenialUseCase } from './application/use-cases/register-entry-denial.use-case';
import { RejectBlockRequestUseCase } from './application/use-cases/reject-block-request.use-case';
import { RevokeVehicleBlockUseCase } from './application/use-cases/revoke-vehicle-block.use-case';

// Presentation
import { BlockRequestsController } from './presentation/http/controllers/block-requests.controller';
import { BlocksController } from './presentation/http/controllers/blocks.controller';
import { EntryDenialsController } from './presentation/http/controllers/entry-denials.controller';

/**
 * Módulo de bloqueios e impedimentos (ADR 0010 — M1).
 *
 * Importa `AuthModule` (guards), `UsersModule` (`USER_REPOSITORY` para nomes de
 * atores) e `VehiclesModule` (`VEHICLE_REPOSITORY` para resolver placa →
 * veículo e `VehicleOrmEntity` para manter `is_blocked` na transação). **Sem
 * ciclo**: vehicles/users não importam blocks.
 */
@Module({
  imports: [
    AuthModule,
    UsersModule,
    VehiclesModule,
    TypeOrmModule.forFeature([
      VehicleBlockOrmEntity,
      EntryDenialOrmEntity,
      BlockRequestOrmEntity,
    ]),
  ],
  providers: [
    ...blocksProviders,
    CreateVehicleBlockUseCase,
    ListVehicleBlocksUseCase,
    GetVehicleBlockUseCase,
    RevokeVehicleBlockUseCase,
    RegisterEntryDenialUseCase,
    CreateBlockRequestUseCase,
    ApproveBlockRequestUseCase,
    RejectBlockRequestUseCase,
    CancelBlockRequestUseCase,
    ListBlockRequestsUseCase,
  ],
  controllers: [
    BlocksController,
    EntryDenialsController,
    BlockRequestsController,
  ],
  exports: [
    VEHICLE_BLOCK_REPOSITORY,
    ENTRY_DENIAL_REPOSITORY,
    BLOCK_REQUEST_REPOSITORY,
  ],
})
export class BlocksModule {}
