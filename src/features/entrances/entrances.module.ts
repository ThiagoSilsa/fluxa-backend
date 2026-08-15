// NestJS
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

// Modules
import { AuthModule } from '../auth/auth.module';

// Repository
import { ENTRANCE_REPOSITORY } from './domain/repositories/entrance.repository';

// Infrastructure
import { entrancesProviders } from './infrastructure/persistence/providers/entrances.providers';
import { EntranceOrmEntity } from './infrastructure/persistence/typeorm/entrance.orm-entity';

// Use cases
import { CreateEntranceUseCase } from './application/use-cases/create-entrance.use-case';
import { DeactivateEntranceUseCase } from './application/use-cases/deactivate-entrance.use-case';
import { GetEntranceUseCase } from './application/use-cases/get-entrance.use-case';
import { ListEntrancesUseCase } from './application/use-cases/list-entrances.use-case';
import { UpdateEntranceUseCase } from './application/use-cases/update-entrance.use-case';

// Presentation
import { EntrancesController } from './presentation/http/controllers/entrances.controller';

/**
 * Módulo de portarias (CRUD por empresa — ADR 0006 §1).
 *
 * Importa `AuthModule` para os use cases de JWT/validação usados pelos guards
 * compartilhados (`JwtAuthGuard`, `PermissionsGuard`).
 */
@Module({
  imports: [AuthModule, TypeOrmModule.forFeature([EntranceOrmEntity])],
  providers: [
    ...entrancesProviders,
    CreateEntranceUseCase,
    ListEntrancesUseCase,
    GetEntranceUseCase,
    UpdateEntranceUseCase,
    DeactivateEntranceUseCase,
  ],
  controllers: [EntrancesController],
  exports: [ENTRANCE_REPOSITORY],
})
export class EntrancesModule {}
